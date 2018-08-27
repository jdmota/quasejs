// @flow
import type { Installer } from "./commands/installer";
import type { Name, Version, ExactVersion, ResolvedObj, Options, DepType } from "./types";
import { error } from "./utils";
import type { Resolution } from "./resolution";
import { toStr } from "./types";
import type { Lockfile } from "./lockfile";
import pacoteOptions from "./pacote-options";

const npa = require( "npm-package-arg" );
const pacote = require( "pacote" );
const semver = require( "semver" );

type Requester = Resolution | DepType;

type Queued = {|
  +name: Name,
  +version: Version,
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
  +sortedLockfile: Map<Name, { version: ExactVersion, index: number }[]>;
  +results: Map<Name, ResolvedObj[]>;
  queueMap: Map<Name, Queued[]>;

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

  findInLockfile( name: Name, version: Version ): ?number {
    if ( this.reuseLockfile ) {
      const resolves = this.sortedLockfile.get( name );
      if ( !resolves ) {
        return;
      }
      for ( const obj of resolves ) {
        if ( semver.satisfies( obj.version, version ) ) {
          return obj.index;
        }
      }
    }
  }

  findInResults( name: Name, version: Version ): ?ResolvedObj {
    const resolves = this.results.get( name );
    if ( !resolves ) {
      return;
    }
    for ( const obj of resolves ) {
      if ( semver.satisfies( obj.version, version ) ) {
        return obj;
      }
    }
  }

  addResult( name: Name, result: ResolvedObj ) {
    let arr = this.results.get( name );
    if ( !arr ) {
      arr = [];
      this.results.set( name, arr );
    }
    arr.push( result );
  }

  queueResolve( name: Name, version: Version, where: Requester ) {
    let arr = this.queueMap.get( name );
    if ( !arr ) {
      arr = [];
      this.queueMap.set( name, arr );
    }

    arr.push( {
      name,
      version,
      where,
      job: resolve( name, version, this.installer.opts )
    } );

    this.installer.emit( "resolutionMore" );
  }

  handleNew( obj: ResolvedObj, where: Requester ) {
    const { name, version, savedVersion, resolved, integrity, deps } = obj;
    const { isNew, resolution } = this.installer.tree.createResolution( { name, version, resolved, integrity } );

    if ( isNew ) {
      for ( const nameStr in deps ) {
        // $FlowIgnore
        const name: Name = nameStr;
        const savedVersion = deps[ name ];
        const possibleIdx = this.findInLockfile( name, savedVersion );

        if ( possibleIdx == null ) {
          const obj = this.findInResults( name, savedVersion );
          if ( obj ) {
            this.handleNew( obj, resolution );
          } else {
            this.queueResolve( name, savedVersion, resolution );
          }
        } else {
          resolution.set.add( this.handleFromLock( possibleIdx ) );
        }
      }
    }

    if ( typeof where === "string" ) {
      this.installer.rootDeps.add( resolution );
      this.newLockfile[ where ][ name ] = {
        savedVersion,
        resolved,
        i: -1
      };
    } else {
      where.set.add( resolution );
    }
  }

  handleFromLock( index: number ): Resolution {
    const tuple = this.lockfile.resolutions[ index ];

    if ( !tuple ) {
      throw error( `Corrupt lockfile. Expected resolution at index ${index}` );
    }

    const [ name, version, resolved, integrity ] = tuple;
    const { isNew, resolution } = this.installer.tree.createResolution( { name, version, resolved, integrity } );

    if ( isNew ) {
      const indexes = this.lockfile.resolutions[ index ][ 4 ];
      for ( const i of indexes ) {
        resolution.set.add( this.handleFromLock( i ) );
      }
    }

    return resolution;
  }

  handleRootDeps( nameStr: string, version: Version, where: Requester ) {
    // $FlowIgnore
    const name: Name = nameStr;

    if ( this.reuseLockfile ) {
      const dep = this.lockfile[ where ][ name ];
      if ( dep ) {
        const { savedVersion, i } = dep;
        if ( savedVersion === version ) {
          this.installer.rootDeps.add( this.handleFromLock( i ) );
          this.newLockfile[ where ][ name ] = dep;
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
    this.queueResolve( name, version, where );
  }

  async start() {

    for ( const name in this.pkg.dependencies ) {
      this.handleRootDeps( name, this.pkg.dependencies[ name ], "deps" );
    }

    for ( const name in this.pkg.devDependencies ) {
      this.handleRootDeps( name, this.pkg.devDependencies[ name ], "devDeps" );
    }

    for ( const name in this.pkg.optionalDependencies ) {
      this.handleRootDeps( name, this.pkg.optionalDependencies[ name ], "optionalDeps" );
    }

    while ( this.queueMap.size > 0 ) {

      const queueMap = this.queueMap;
      this.queueMap = new Map();

      // Cache resolve results
      for ( const queuedList of queueMap.values() ) {
        for ( const { name, job } of queuedList ) {
          this.addResult( name, await job );
          this.installer.emit( "resolutionUpdate" );
        }
      }

      // Sort them again
      for ( const results of this.results.values() ) {
        results.sort( VERSION_COMPARATOR );
      }

      for ( const queuedList of queueMap.values() ) {
        for ( const queued of queuedList ) {
          const { name, version, where } = queued;
          const obj = this.findInResults( name, version );
          if ( obj ) {
            this.handleNew( obj, where );
          } else {
            throw new Error( "Assertion" );
          }
        }
      }

    }

  }

}

async function resolve( name: Name, version: Version, opts: Options ): Promise<ResolvedObj> {

  if ( !name ) {
    throw new Error( "Missing name" );
  }

  if ( !version ) {
    throw new Error( `Missing version for name '${toStr( name )}'` );
  }

  const spec = npa.resolve( name, version );

  const pkg = await pacote.manifest( spec, pacoteOptions( opts ) );

  if ( pkg.name !== name ) {
    throw new Error( `Name '${toStr( name )}' does not match the name in the manifest: ${pkg.name} (version: ${pkg.version})` );
  }

  return {
    name: pkg.name,
    version: pkg.version,
    savedVersion: version,
    resolved: pkg._resolved,
    integrity: pkg._integrity + "",
    deps: pkg.dependencies
  };
}

function sortLockfile( lockfile: Lockfile ): Map<Name, { version: ExactVersion, index: number }[]> {
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
