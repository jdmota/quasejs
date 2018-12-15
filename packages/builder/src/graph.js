// @flow
import type Module from "./module";
import { hashName } from "./utils/hash";
import { reExt } from "./utils/path";
import type { FinalAsset } from "./types";
import type Builder from "./builder";

const modulesSorter = ( { id: a }, { id: b } ) => a.localeCompare( b );

// Adapted from https://github.com/samthor/srcgraph

export class Graph {

  +modules: Map<string, Module>;
  +moduleEntries: Set<Module>;
  +entrypoints: Set<Module>;
  +incs: Map<Module, Module[]>;
  +inline: Map<Module, Module>;

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

    // If a module was splitted from some other module,
    // make sure it's not inlined and make it an entrypoint.
    for ( const split of splitPoints ) {
      this.entrypoints.add( split );
      this.inline.delete( split );
    }

    // If a module is required in more than one module,
    // don't inline it. Otherwise, make it an entrypoint.
    for ( const inline of this.inline.keys() ) {
      const r = this.requiredBy( inline );
      if ( r.length === 1 ) {
        this.entrypoints.add( inline );
      } else {
        this.inline.delete( inline );
      }
    }

    // Sort...
    this.incs.forEach( value => value.sort( modulesSorter ) );

    if ( builder.options.optimization.hashId ) {
      // Give hash names to each module
      // To have deterministic results in the presence of conflicts
      // Sort all the modules by their original id

      const usedIds = new Set();
      const modulesList = Array.from( this.modules.values() ).sort( modulesSorter );

      for ( const module of modulesList ) {
        module.hashId = hashName( module.id, usedIds, 5 );
      }
    }
  }

  // Get all the sync dependencies of a module
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

  async dumpDotGraph( file: string ) {
    // $FlowIgnore
    const graphviz = require( "graphviz" );
    const fs = require( "fs-extra" );
    const g = graphviz.digraph( "G" );

    const modulesList = Array.from( this.modules.values() ).sort( modulesSorter );

    for ( const module of modulesList ) {
      const n = g.addNode( module.id );
      n.set( "color", "gray" );
      n.set( "shape", "box" );
      n.set( "style", "filled" );
    }

    for ( const module of modulesList ) {
      for ( const { required } of module.deps.values() ) {
        g.addEdge( module.id, required.id );
      }
    }

    await fs.outputFile( file, g.to_dot() );
  }

}

export function processGraph( graph: Graph ) {
  // every bit at 1 says that the module belongs to a certain group
  // for example
  // 1010 is for the module that is reached from entrypoint index 1 and 3
  // 1010 == ( 1 << 1 ) || ( 1 << 3 )
  const groups: Map<Module, number> = new Map();

  let n = 0;
  for ( const entrypoint of graph.entrypoints ) {
    const pending = new Set( [ entrypoint ] );
    for ( const next of pending ) {
      groups.set( next, ( groups.get( next ) || 0 ) | ( 1 << n ) );
      for ( const { required } of graph.requires( next ).values() ) {
        pending.add( required );
      }
    }
    n++;
  }

  // Find all modules that will be in the file
  // with entrypoint "from"
  const grow = ( from: Module ): ?Module[] => {
    const group = groups.get( from );
    const wouldSplitSrc = src => {
      // Entrypoints are always their own starting point
      if ( graph.entrypoints.has( src ) ) {
        return true;
      }
      // Split if "src" belongs to a different group
      if ( groups.get( src ) !== group ) {
        return true;
      }
      // Split if "src" has an input from other group
      const all = graph.requiredBy( src );
      return all.some( other => groups.get( other ) !== group );
    };

    // Not a module entrypoint
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

  groups.forEach( ( _, m ) => {
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

      // If "m" is a module that will be inline
      if ( graph.inline.has( m ) ) {
        inlineAssets.push( f );
      } else {
        files.push( f );
      }

      // For each module, what file it belongs to
      for ( const src of srcs ) {
        moduleToFile.set( src, f );
      }
    }
  } );

  // Save inline assets in each respective asset that required it
  for ( const inlineAsset of inlineAssets ) {
    const requiredBy = get( graph.inline, inlineAsset.module );
    get( moduleToFile, requiredBy ).inlineAssets.push( inlineAsset );
  }

  // Attempt to have simpler unique file names
  for ( const f of files ) {
    const possibleDest = f.relativePath.replace( reExt, `.${f.type}` );
    const arr = filesByPath.get( possibleDest ) || [];
    arr.push( f );
    filesByPath.set( possibleDest, arr );
  }

  // Only assign the new file name, if it conflicts with no other file
  for ( const [ possibleDest, files ] of filesByPath ) {
    if ( files.length === 1 ) {
      files[ 0 ].relativeDest = possibleDest;
    }
  }

  // Now remove modules from inline assets for the next step
  for ( const [ module, file ] of moduleToFile ) {
    if ( graph.inline.has( file.module ) ) {
      moduleToFile.delete( module );
    }
  }

  // Produce the "module" -> "asset" mapping necessary for the runtime
  // It tells for each module, which files it needs to fetch
  const moduleToAssets: Map<Module, FinalAsset[]> = new Map();
  for ( const [ module, file ] of moduleToFile ) {

    const set: Set<FinalAsset> = new Set( [ file ] );

    for ( const dep of graph.syncDeps( module ) ) {
      const asset = moduleToFile.get( dep );
      if ( asset ) {
        set.add( asset );
      }
    }

    // Sort to get deterministic results
    moduleToAssets.set( module, Array.from( set ).sort( modulesSorter ) );
  }

  return {
    modules: graph.modules,
    files: sortFilesByEntry( files ), // Leave entries last
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
