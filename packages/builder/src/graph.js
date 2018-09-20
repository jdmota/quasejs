// @flow
import type Module from "./module";
import { hashName } from "./utils/hash";
import { reExt } from "./utils/path";
import type { FinalAsset } from "./types";
import type Builder from "./builder";

const modulesSorter = ( { id: a }, { id: b } ) => a.localeCompare( b );

// Adapted from https://github.com/samthor/srcgraph

export class Graph {

  modules: Map<string, Module>;
  moduleEntries: Set<Module>;
  entrypoints: Set<Module>;
  incs: Map<Module, Module[]>;
  inline: Map<Module, Module>;

  constructor() {
    this.modules = new Map();
    this.moduleEntries = new Set();
    this.entrypoints = new Set();
    this.incs = new Map();
    this.inline = new Map();
  }

  add( module: Module ) {
    this.modules.set( module.id, module );
    this.incs.set( module, [] );
  }

  remove( module: Module ) {
    this.modules.delete( module.id );
    this.incs.delete( module );
    module.unref();
  }

  addEntry( module: Module ) {
    this.moduleEntries.add( module );
    this.entrypoints.add( module );
  }

  init( builder: Builder ) {

    const splitPoints = new Set();

    for ( const module of this.modules.values() ) {
      for ( const { required, splitPoint } of module.deps.values() ) {
        if ( splitPoint ) {
          splitPoints.add( required );
        } else if ( required.innerId || required.type !== module.type ) {
          this.inline.set( required, module );
        }
        const l = this.incs.get( required );
        if ( l && !l.includes( module ) ) {
          l.push( module );
        }
      }
    }

    for ( const split of splitPoints ) {
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

    if ( builder.options.optimization.hashId ) {
      const usedIds = new Set();
      const modulesList = Array.from( this.modules.values() ).sort( modulesSorter );

      for ( const module of modulesList ) {
        module.hashId = hashName( module.id, usedIds, 5 );
      }
    }
  }

  syncDeps( module: Module, set: Set<Module> = new Set() ) {
    for ( const { required, async } of this.requires( module ).values() ) {
      if ( !async && !set.has( required ) ) {
        set.add( required );
        this.syncDeps( required, set );
      }
    }
    return set;
  }

  requires( module: Module ) {
    return module.deps;
  }

  requiredBy( module: Module ) {
    return this.incs.get( module ) || [];
  }
}

export function processGraph( graph: Graph ) {
  // every bit at 1 says that the module belongs to a certain group
  // for example
  // 1010 is for the module that is reached from entrypoint index 1 and 3
  // 1010 == ( 1 << 1 ) || ( 1 << 3 )
  const hashes: Map<Module, number> = new Map();

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
  const grow = ( from: Module ): ?Module[] => {
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
  const moduleToFile: Map<Module, FinalAsset> = new Map();

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
        relativePath: m.relativePath,
        relativeDest: m.relativeDest,
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
    const possibleDest = f.relativePath.replace( reExt, `.${f.type}` );
    const arr = filesByPath.get( possibleDest ) || [];
    arr.push( f );
    filesByPath.set( possibleDest, arr );
  }

  for ( const [ possibleDest, files ] of filesByPath ) {
    if ( files.length === 1 ) {
      files[ 0 ].relativeDest = possibleDest;
    }
  }

  const moduleToAssets: Map<Module, FinalAsset[]> = new Map();
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
