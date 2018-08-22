// @flow
import type Module from "./modules/index";
import PublicModule from "./modules/public";
import { hashName } from "./utils/hash";
import type { FinalAsset } from "./types";
import type Builder, { Build } from "./builder";
import { reExt } from "./id";

const modulesSorter = ( { id: a }, { id: b } ) => a.localeCompare( b );

// Adapted from https://github.com/samthor/srcgraph

export class Graph {

  modules: Map<string, PublicModule>;
  moduleEntries: Set<PublicModule>;
  incs: Map<PublicModule, PublicModule[]>;
  entrypoints: Set<PublicModule>;
  splitPoints: Set<PublicModule>;
  inline: Map<PublicModule, PublicModule>;

  constructor( build: Build, moduleEntries: Set<Module> ) {
    this.modules = new Map();
    this.moduleEntries = new Set();
    this.incs = new Map();
    this.entrypoints = new Set();
    this.splitPoints = new Set();
    this.inline = new Map();

    for ( const module of build.modules.values() ) {
      this.modules.set( module.id, new PublicModule( module ) );
    }

    for ( const { id } of moduleEntries ) {
      const m = this.get( id );
      this.moduleEntries.add( m );
      this.entrypoints.add( m );
    }
  }

  get( id: string ): PublicModule {
    const m = this.modules.get( id );
    if ( m ) {
      return m;
    }
    throw new Error( `Internal: can't get ${id}` );
  }

  async init( builder: Builder ) {
    const usedIds = new Set();
    const modulesList = Array.from( this.modules.values() ).sort( modulesSorter );

    for ( const module of modulesList ) {
      module.hashId = builder.optimization.hashId ? hashName( module.id, usedIds, 5 ) : module.id;
      module.loadResult = await module.load;
      module.transformResult = await module.transform;
      module.depsInfo = await module.getDeps;

      const deps = await module.resolveDeps;
      for ( const dep of deps.values() ) {
        // $FlowIgnore
        module.deps.set( dep.request, {
          ...dep,
          required: this.get( dep.required.id )
        } );
      }
    }

    for ( const module of this.modules.values() ) {
      this.incs.set( module, [] );
    }

    for ( const module of this.modules.values() ) {
      for ( const { required, splitPoint } of module.deps.values() ) {
        if ( splitPoint || builder.options.hmr ) {
          this.splitPoints.add( required );
        } else if ( required.type !== module.type ) {
          this.inline.set( required, module );
        }
        const l = this.incs.get( required );
        if ( l && !l.includes( module ) ) {
          l.push( module );
        }
      }
    }

    for ( const split of this.splitPoints ) {
      this.entrypoints.add( split );
      this.inline.delete( split );
    }

    for ( const inline of this.inline.keys() ) {
      const r = this.requiredBy( inline );
      if ( r.length === 1 ) {
        this.entrypoints.add( inline );
      } else {
        this.inline.delete( inline );
      }
    }

    this.incs.forEach( value => value.sort( modulesSorter ) );
  }

  syncDeps( module: PublicModule, set: Set<PublicModule> = new Set() ) {
    for ( const { required, async } of this.requires( module ).values() ) {
      if ( !async && !set.has( required ) ) {
        set.add( required );
        this.syncDeps( required, set );
      }
    }
    return set;
  }

  requires( module: PublicModule ) {
    return module.deps;
  }

  requiredBy( module: PublicModule ) {
    return this.incs.get( module ) || [];
  }
}

export function processGraph( graph: Graph ) {
  // walk over graph and set (1<<n) for all demands
  const hashes: Map<PublicModule, number> = new Map();

  let n = 0;
  for ( const entrypoint of graph.entrypoints ) {
    const pending = new Set( [ entrypoint ] );
    for ( const next of pending ) {
      hashes.set( next, ( hashes.get( next ) || 0 ) | ( 1 << n ) );
      for ( const { required } of graph.requires( next ).values() ) {
        pending.add( required );
      }
    }
    n++;
  }

  // find all files in the same module
  const grow = ( from: PublicModule ): ?PublicModule[] => {
    const hash = hashes.get( from );
    const wouldSplitSrc = src => {
      // entrypoints are always their own starting point
      if ( graph.entrypoints.has( src ) ) {
        return true;
      }
      // checks that the src is the given hash, AND has inputs only matching that hash
      if ( hashes.get( src ) !== hash ) {
        return true;
      }
      const all = graph.requiredBy( src );
      return all.some( other => hashes.get( other ) !== hash );
    };

    // not a module entrypoint
    if ( !wouldSplitSrc( from ) ) {
      return null;
    }

    const include = [ from ];
    const seen = new Set( include );

    for ( let i = 0, curr; curr = include[ i ]; ++i ) {
      const pending = graph.requires( curr );
      for ( const { required } of pending.values() ) {
        if ( seen.has( required ) ) {
          continue;
        }
        seen.add( required );
        if ( !wouldSplitSrc( required ) ) {
          include.push( required );
        }
      }
    }

    return include;
  };

  const files = [];
  const inlineAssets = [];
  const filesByPath = new Map();
  const moduleToFile: Map<PublicModule, FinalAsset> = new Map();

  hashes.forEach( ( hash, m ) => {
    const srcs = grow( m );
    if ( srcs ) {
      const f = {
        module: m,
        id: m.id,
        path: m.path,
        type: m.type,
        innerId: m.innerId,
        normalized: m.normalized,
        dest: m.dest,
        relative: m.relative,
        hash: null,
        isEntry: graph.moduleEntries.has( m ),
        runtime: null,
        inlineAssets: [],
        srcs
      };

      if ( graph.inline.has( m ) ) {
        inlineAssets.push( f );
      } else {
        files.push( f );
      }

      for ( const src of srcs ) {
        moduleToFile.set( src, f );
      }
    }
  } );

  for ( const inlineAsset of inlineAssets ) {
    const requiredBy = get( graph.inline, inlineAsset.module );
    get( moduleToFile, requiredBy ).inlineAssets.push( inlineAsset );
  }

  for ( const [ module, file ] of moduleToFile ) {
    if ( graph.inline.has( file.module ) ) {
      moduleToFile.delete( module );
    }
  }

  for ( const f of files ) {
    const possibleDest = f.dest.replace( reExt, `.${f.type}` );
    const arr = filesByPath.get( possibleDest ) || [];
    arr.push( f );
    filesByPath.set( possibleDest, arr );
  }

  for ( const [ possibleDest, files ] of filesByPath ) {
    if ( files.length === 1 ) {
      const f = files[ 0 ];
      f.dest = possibleDest;
      f.relative = f.relative.replace( reExt, `.${f.type}` );
    } else {
      for ( const f of files ) {
        if ( f.innerId ) {
          f.dest = `${f.dest}.${f.innerId}.${f.type}`;
          f.relative = `${f.relative}.${f.innerId}.${f.type}`;
        } else {
          f.dest = `${f.dest}.${f.type}`;
          f.relative = `${f.relative}.${f.type}`;
        }
      }
    }
  }

  const moduleToAssets: Map<PublicModule, FinalAsset[]> = new Map();
  for ( const [ module, file ] of moduleToFile ) {

    const set: Set<FinalAsset> = new Set( [ file ] );

    for ( const dep of graph.syncDeps( module ) ) {
      const asset = moduleToFile.get( dep );
      if ( asset ) {
        set.add( asset );
      }
    }

    moduleToAssets.set( module, Array.from( set ).sort( modulesSorter ) );
  }

  return {
    modules: graph.modules,
    files: sortFilesByEntry( files ),
    moduleToAssets
  };
}

function sortFilesByEntry( files ) {
  // $FlowFixMe
  return files.sort( ( a, b ) => a.isEntry - b.isEntry );
}

function get<K, V>( map: Map<K, V>, key: K ): V {
  // $FlowFixMe
  return map.get( key );
}
