import { Manifest, FinalModule, FinalAsset, ProcessedGraph } from "../types";
import { hashName } from "../utils/hash";
import { reExt } from "../utils/path";
import { UserConfig } from "./user-config";

const modulesSorter = ( { id: a }: { id: string }, { id: b }: { id: string } ) => a.localeCompare( b );

export class Graph {

  modules: Map<string, FinalModule>;
  moduleEntries: Set<FinalModule>;
  entrypoints: Set<FinalModule>;
  incs: Map<FinalModule, FinalModule[]>;
  inline: Map<FinalModule, FinalModule>;
  private markedEntries: Set<string>;

  constructor() {
    this.modules = new Map();
    this.moduleEntries = new Set();
    this.entrypoints = new Set();
    this.incs = new Map();
    this.inline = new Map();
    this.markedEntries = new Set();
  }

  [Symbol.iterator]() {
    return this.modules.entries();
  }

  exists( id: string ) {
    return this.modules.has( id );
  }

  add( module: FinalModule ) {
    this.modules.set( module.id, module );
    this.incs.set( module, [] );
  }

  markEntry( id: string ) {
    this.markedEntries.add( id );
  }

  init( userConfig: UserConfig ) {
    for ( const id of this.markedEntries ) {
      const m = get( this.modules, id );
      this.moduleEntries.add( m );
      this.entrypoints.add( m );
    }

    if ( userConfig.optimization.hashId ) {
      // Give hash names to each module
      // To have deterministic results in the presence of conflicts
      // Sort all the modules by their original id

      const usedIds: Set<string> = new Set();
      const modulesList = Array.from( this.modules.values() ).sort( modulesSorter );

      for ( const module of modulesList ) {
        module.hashId = hashName( module.id, usedIds, 5 );
      }
    }

    const splitPoints: Set<FinalModule> = new Set();

    for ( const module of this.modules.values() ) {
      for ( const dep of module.requires ) {
        const required = get( this.modules, dep.id );
        const splitPoint = dep.async || userConfig.isSplitPoint( required, module );

        dep.hashId = required.hashId;

        if ( splitPoint ) {
          splitPoints.add( required );
        } else if ( required.innerId || required.asset.type !== module.asset.type ) {
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
  }

  // Get all the sync dependencies of a module
  syncDeps( module: FinalModule, set: Set<FinalModule> = new Set() ) {
    for ( const { id, async } of module.requires ) {
      const required = get( this.modules, id );

      if ( !async && !set.has( required ) ) {
        set.add( required );
        this.syncDeps( required, set );
      }
    }
    return set;
  }

  requiredAssets( module: FinalModule, moduleToFile: Map<FinalModule, FinalAsset>, exclude?: FinalAsset ) {
    const set: Set<FinalAsset> = new Set();

    const asset = moduleToFile.get( module );
    if ( asset && asset !== exclude ) {
      set.add( asset );
    }

    for ( const dep of this.syncDeps( module ) ) {
      const asset = moduleToFile.get( dep );
      if ( asset && asset !== exclude ) {
        set.add( asset );
      }
    }
    return Array.from( set );
  }

  requiredBy( module: FinalModule ) {
    return this.incs.get( module ) || [];
  }

  async dumpDotGraph( file: string ) {
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
      for ( const { id } of module.requires ) {
        g.addEdge( module.id, id );
      }
    }

    await fs.outputFile( file, g.to_dot() );
  }

}

// Adapted from https://github.com/samthor/srcgraph

export function processGraph( graph: Graph ): ProcessedGraph {
  // every bit at 1 says that the module belongs to a certain group
  // for example
  // 1010 is for the module that is reached from entrypoint index 1 and 3
  // 1010 == ( 1 << 1 ) || ( 1 << 3 )
  const groups: Map<FinalModule, number> = new Map();

  let n = 0;
  for ( const entrypoint of graph.entrypoints ) {
    const pending = new Set( [ entrypoint ] );
    for ( const next of pending ) {
      groups.set( next, ( groups.get( next ) || 0 ) | ( 1 << n ) );
      for ( const { id } of next.requires ) {
        pending.add( get( graph.modules, id ) );
      }
    }
    n++;
  }

  // Find all modules that will be in the file
  // with entrypoint "from"
  const grow = ( from: FinalModule ): Map<string, FinalModule>|null => {
    const group = groups.get( from );
    const wouldSplitSrc = ( src: FinalModule ) => {
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

    const result = new Map( [ [ from.id, from ] ] );
    const include = [ from ];
    const seen = new Set( include );

    for ( let i = 0, curr; curr = include[ i ]; ++i ) {
      for ( const { id } of curr.requires ) {
        const required = get( graph.modules, id );

        if ( seen.has( required ) ) {
          continue;
        }
        seen.add( required );
        if ( !wouldSplitSrc( required ) ) {
          include.push( required );
          result.set( required.id, required );
        }
      }
    }

    return result;
  };

  const files: FinalAsset[] = [];
  const inlineAssets: FinalAsset[] = [];
  const filesByPath: Map<string, FinalAsset[]> = new Map();
  const moduleToFile: Map<FinalModule, FinalAsset> = new Map();

  for ( const m of groups.keys() ) {
    const srcs = grow( m );
    if ( srcs ) {
      const f: FinalAsset = {
        module: m,
        relativeDest: m.relativePath.replace( reExt, `.${m.hashId}.${m.asset.type}` ),
        hash: null,
        isEntry: graph.moduleEntries.has( m ),
        srcs,
        inlineAssets: [],
        runtime: {
          code: null,
          manifest: null
        },
        manifest: {
          files: [],
          moduleToAssets: new Map()
        },
      };

      // If "m" is a module that will be inline
      if ( graph.inline.has( m ) ) {
        inlineAssets.push( f );
      } else {
        files.push( f );
      }

      // For each module, what file it belongs to
      for ( const src of srcs.values() ) {
        moduleToFile.set( src, f );
      }
    }
  }

  // Save inline assets in each respective asset that required it
  for ( const inlineAsset of inlineAssets ) {
    const requiredBy = get( graph.inline, inlineAsset.module );
    get( moduleToFile, requiredBy ).inlineAssets.push( inlineAsset );
  }

  // Attempt to have simpler unique file names
  for ( const f of files ) {
    const possibleDest = f.module.relativePath.replace( reExt, `.${f.module.asset.type}` );
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

  // Extract the modules that are dependencies of modules in this asset
  // Excluding modules already in this asset
  function assetDependencies( asset: FinalAsset ): Set<FinalModule> {
    const set: Set<FinalModule> = new Set();
    for ( const src of asset.srcs.values() ) {
      for ( const { id } of src.requires ) {
        const required = get( graph.modules, id );

        if ( !asset.srcs.has( required.id ) ) {
          set.add( required );
        }
      }
    }
    return set;
  }

  // Manifest for each asset
  function manifest( asset: FinalAsset ): Manifest {
    // Produce the "module" -> "asset" mapping necessary for the runtime
    // It tells for each module, which files it needs to fetch
    const moduleToAssets: Map<string, string[]> = new Map();
    const files: Set<string> = new Set();

    for ( const module of assetDependencies( asset ) ) {
      const array = graph.requiredAssets( module, moduleToFile, asset );
      if ( array.length > 0 ) {
        for ( const f of array ) {
          files.add( f.relativeDest );
        }
        // Sort to get deterministic results
        moduleToAssets.set( module.hashId, array.map( f => f.relativeDest ) );
      }
    }
    return {
      files: Array.from( files ).sort(),
      moduleToAssets
    };
  }

  for ( const f of files ) {
    f.manifest = manifest( f );
  }

  return {
    moduleToFile,
    files: sortFilesByEntry( files ) // Leave entries last
  };
}

function sortFilesByEntry( files: FinalAsset[] ) {
  return files.sort( ( a, b ) => ( +a.isEntry ) - ( +b.isEntry ) );
}

function get<K, V>( map: Map<K, V>, key: K ): V {
  const value = map.get( key );
  if ( value ) {
    return value;
  }
  throw new Error( "Assertion error" );
}
