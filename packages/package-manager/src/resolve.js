// @flow
import type { Installer } from "./commands/installer";
import type {
  AliasName, ActualName, Spec, RangeVersion, ExactVersion,
  ResolvedObj, Options, DepType
} from "./types";
import { error } from "./utils";
import { type Resolution } from "./resolution";
import { toStr } from "./types";
import type { Lockfile } from "./lockfile";
import pacoteOptions from "./pacote-options";
import { iterate as iteratePkg } from "./pkg";

const npa = require( "npm-package-arg" );
const pacote = require( "pacote" );
const semver = require( "semver" );

type Requester = Resolution | DepType;

export type Parsed = {
  alias: AliasName,
  name: ActualName,
  version: RangeVersion,
  spec: Spec
};

type Queued = {|
  +parsed: Parsed;
  +where: Requester,
  +job: Promise<ResolvedObj>
|};

const VERSION_COMPARATOR = ( a, b ) => semver.rcompare( a.version, b.version );

export class Resolver {

  +installer: Installer;
  +pkg: Object;
  +lockfile: Object;
  +newLockfile: Object;
  +reuseLockfile: boolean;
  +frozenLockfile: boolean;
  +sortedLockfile: Map<ActualName, { version: ExactVersion, index: number }[]>;
  +results: Map<ActualName, ResolvedObj[]>;
  queueMap: Map<ActualName, Queued[]>;

  constructor( installer: Installer, pkg: Object, lockfile: Lockfile, newLockfile: Lockfile ) {
    this.installer = installer;
    this.pkg = pkg;
    this.lockfile = lockfile;
    this.newLockfile = newLockfile;
    this.reuseLockfile = installer.reuseLockfile;
    this.frozenLockfile = installer.opts.frozenLockfile;
    this.sortedLockfile = this.reuseLockfile ? sortLockfile( lockfile ) : new Map();
    this.results = new Map();
    // This queue saves information about new resolve operations that were necessary
    // because a matching version was not found in the lockfile
    // We leave the results pending here to then dedupe if possible
    this.queueMap = new Map();
  }

  findInLockfile( parsed: Parsed ): ?number {
    if ( this.reuseLockfile ) {
      const resolves = this.sortedLockfile.get( parsed.name );
      if ( !resolves ) {
        return;
      }
      for ( const obj of resolves ) {
        if ( semver.satisfies( obj.version, parsed.version ) ) {
          return obj.index;
        }
      }
    }
  }

  findInResults( parsed: Parsed ): ?ResolvedObj {
    const resolves = this.results.get( parsed.name );
    if ( !resolves ) {
      return;
    }
    for ( const obj of resolves ) {
      if ( semver.satisfies( obj.version, parsed.version ) ) {
        return obj;
      }
    }
  }

  addResult( parsed: Parsed, result: ResolvedObj ) {
    let arr = this.results.get( parsed.name );
    if ( !arr ) {
      arr = [];
      this.results.set( parsed.name, arr );
    }
    arr.push( result );
  }

  queueResolve( parsed: Parsed, where: Requester ) {
    let arr = this.queueMap.get( parsed.name );
    if ( !arr ) {
      arr = [];
      this.queueMap.set( parsed.name, arr );
    }

    arr.push( {
      parsed,
      where,
      job: resolve( parsed, this.installer.opts )
    } );

    this.installer.reporter.resolutionMore();
  }

  handleNew( obj: ResolvedObj, where: Requester, parsed: Parsed ) {
    const { name, version, resolved, integrity, deps } = obj;
    const { isNew, resolution } = this.installer.tree.createResolution( {
      name,
      version,
      resolved,
      integrity
    } );

    if ( isNew ) {
      iteratePkg( deps, parsed => {
        const possibleIdx = this.findInLockfile( parsed );

        if ( possibleIdx == null ) {
          const obj = this.findInResults( parsed );
          if ( obj ) {
            this.handleNew( obj, resolution, parsed );
          } else {
            this.queueResolve( parsed, resolution );
          }
        } else {
          resolution.addDep( parsed.alias, this.handleFromLock( possibleIdx ) );
        }
      } );
    }

    if ( typeof where === "string" ) {
      this.installer.rootDeps.set( parsed.alias, resolution );
      this.newLockfile[ where ][ parsed.alias ] = {
        spec: parsed.spec,
        resolved,
        i: -1
      };
    } else {
      where.addDep( parsed.alias, resolution );
    }
  }

  handleFromLock( index: number ): Resolution {
    const tuple = this.lockfile.resolutions[ index ];

    if ( !tuple ) {
      throw error( `Corrupt lockfile. Expected resolution at index ${index}` );
    }

    const [ name, version, resolved, integrity ] = tuple;
    const { isNew, resolution } = this.installer.tree.createResolution( {
      name,
      version,
      resolved,
      integrity
    } );

    if ( isNew ) {
      const deps = this.lockfile.resolutions[ index ][ 4 ];
      for ( const aliasStr in deps ) {
        // $FlowIgnore
        const alias: AliasName = aliasStr;
        resolution.addDep( alias, this.handleFromLock( deps[ alias ] ) );
      }
    }

    return resolution;
  }

  handleRootDeps( parsed: Parsed, type: DepType ) {

    if ( this.reuseLockfile ) {
      const dep = this.lockfile[ type ][ parsed.alias ];
      if ( dep ) {
        const { spec, i } = dep;
        if ( spec === parsed.spec ) {
          this.installer.rootDeps.set( parsed.alias, this.handleFromLock( i ) );
          this.newLockfile[ type ][ parsed.alias ] = dep;
          return;
        }
        // Usually, if a version in package.json is different than before,
        // it's because the user wants to update it.
        // Don't reuse lockfile
      }
    }

    if ( this.frozenLockfile ) {
      throw error( "This installation requires an update." );
    }

    // We have no results yet since we are still handling the dependencies in pkg
    this.queueResolve( parsed, type );
  }

  async start() {

    iteratePkg( this.pkg.dependencies, parsed => {
      this.handleRootDeps( parsed, "deps" );
    } );

    if ( !this.installer.opts.production ) {
      iteratePkg( this.pkg.devDependencies, parsed => {
        this.handleRootDeps( parsed, "devDeps" );
      } );
    }

    iteratePkg( this.pkg.optionalDependencies, parsed => {
      this.handleRootDeps( parsed, "optionalDeps" );
    } );

    while ( this.queueMap.size > 0 ) {

      const queueMap = this.queueMap;
      this.queueMap = new Map();

      // Cache resolve results
      for ( const queuedList of queueMap.values() ) {
        for ( const { parsed, job } of queuedList ) {
          this.addResult( parsed, await job );
          this.installer.reporter.resolutionMore();
        }
      }

      // Sort them again
      for ( const results of this.results.values() ) {
        results.sort( VERSION_COMPARATOR );
      }

      for ( const queuedList of queueMap.values() ) {
        for ( const queued of queuedList ) {
          const { parsed, where } = queued;
          const obj = this.findInResults( parsed );
          if ( obj ) {
            this.handleNew( obj, where, parsed );
          } else {
            throw new Error( "Assertion" );
          }
        }
      }

    }

  }

}

export function parseSpec( spec: string ): { name: string, version: ?string } {
  const i = spec.lastIndexOf( "@" );

  if ( i <= 0 ) {
    const name = spec.trim();

    return {
      name,
      version: null
    };
  }

  const name = spec.slice( 0, i ).trim();
  const version = spec.slice( i + 1 ).trim();

  const validatedRange = semver.validRange( version );

  if ( validatedRange == null ) {
    throw error( `Invalid version/range for ${name}` );
  }

  return {
    name,
    version: validatedRange
  };
}

export function parseLoose( alias: string, spec: string ): {
  alias: string,
  name: string,
  version: ?string,
  spec: string
} {
  if ( spec.startsWith( "npm:" ) ) {
    const { name, version } = parseSpec( spec.replace( /^npm:/, "" ) );
    return {
      alias,
      name,
      version,
      spec
    };
  }
  return {
    alias,
    name: alias,
    version: spec,
    spec
  };
}

export function parse( alias: string, spec: string ): Parsed {
  const parsed = parseLoose( alias, spec );
  if ( parsed.version == null ) {
    throw error(
      `No version provided in ${JSON.stringify( parsed.alias )}: ${JSON.stringify( parsed.spec )}`
    );
  }
  // $FlowIgnore
  return parsed;
}

async function resolve( parsed: Parsed, opts: Options ): Promise<ResolvedObj> {

  const spec = npa.resolve( parsed.name, parsed.version );

  const pkg = await pacote.manifest( spec, pacoteOptions( opts ) );

  if ( pkg.name !== parsed.name ) {
    throw new Error( `Name '${toStr( parsed.name )}' does not match the name in the manifest: ${pkg.name} (version: ${pkg.version})` );
  }

  return {
    name: pkg.name,
    version: pkg.version,
    resolved: pkg._resolved,
    integrity: pkg._integrity + "",
    deps: pkg.dependencies
  };
}

function sortLockfile( lockfile: Lockfile ): Map<ActualName, { version: ExactVersion, index: number }[]> {
  const map = new Map();
  const { resolutions } = lockfile;
  for ( let i = 0; i < resolutions.length; i++ ) {
    const [ name, version ] = resolutions[ i ];
    let arr = map.get( name );
    if ( !arr ) {
      arr = [];
      map.set( name, arr );
    }
    arr.push( { version, index: i } );
  }
  for ( const arr of map.values() ) {
    arr.sort( VERSION_COMPARATOR );
  }
  return map;
}
