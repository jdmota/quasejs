// @flow
import { reExt } from "./id";
import type Builder from "./builder";
import type Module from "./module";
import type { ModuleDep, FinalAsset } from "./types";

const modulesSorter = ( { id: a }, { id: b } ) => a.localeCompare( b );

// Adapted from https://github.com/samthor/srcgraph

class BiMap {

  deps: Map<Module, $ReadOnlyArray<ModuleDep>>;
  incs: Map<Module, Module[]>;
  entrypoints: Set<Module>;

  constructor( builder: Builder ) {
    this.deps = new Map();
    this.incs = new Map();
    this.entrypoints = new Set( builder.moduleEntries );
  }

  init( builder: Builder ) {
    for ( const module of builder.modules.values() ) {
      this.deps.set( module, Array.from( module.getModuleDeps().values() ) );
    }

    for ( const module of this.deps.keys() ) {
      this.incs.set( module, [ module ] );
    }

    this.deps.forEach( ( requiredList, module ) => {
      requiredList.forEach( ( { required, splitPoint } ) => {
        if ( splitPoint ) {
          this.entrypoints.add( required );
        }
        const l = this.incs.get( required );
        if ( l && l.indexOf( module ) === -1 ) {
          l.push( module );
        }
      } );
    } );

    this.incs.forEach( value => value.sort( modulesSorter ) );
  }

  syncDeps( module: Module, set: Set<Module> = new Set() ) {
    for ( const { required, async } of this.requires( module ) ) {
      if ( !async && !set.has( required ) ) {
        set.add( required );
        this.syncDeps( required, set );
      }
    }
    return set;
  }

  requires( module: Module ) {
    return this.deps.get( module ) || [];
  }

  requiredBy( module: Module ) {
    return this.incs.get( module ) || [];
  }
}

export default function processGraph( builder: Builder ) {
  const map = new BiMap( builder );
  map.init( builder );

  const entrypoints = Array.from( map.entrypoints );

  // walk over graph and set (1<<n) for all demands
  const hashes: Map<Module, number> = new Map();
  entrypoints.forEach( ( entrypoint, n ) => {
    const pending = new Set( [ entrypoint ] );
    pending.forEach( next => {
      hashes.set( next, ( hashes.get( next ) || 0 ) | ( 1 << n ) );
      map.requires( next ).forEach( ( { required } ) => pending.add( required ) );
    } );
  } );

  // find all files in the same module
  const grow = ( from: Module ): ?Module[] => {
    const hash = hashes.get( from );
    const wouldSplitSrc = src => {
      // entrypoints are always their own starting point
      if ( entrypoints.includes( src ) ) {
        return true;
      }
      // checks that the src is the given hash, AND has inputs only matching that hash
      if ( hashes.get( src ) !== hash ) {
        return true;
      }
      const all = map.requiredBy( src );
      return all.some( other => hashes.get( other ) !== hash );
    };

    // not a module entrypoint
    if ( !wouldSplitSrc( from ) ) {
      return null;
    }

    const include = [ from ];
    const seen = new Set( include );

    for ( let i = 0, curr; curr = include[ i ]; ++i ) {
      const pending = map.requires( curr );
      for ( let j = 0, cand; cand = pending[ j ]; ++j ) {
        if ( seen.has( cand.required ) ) {
          continue;
        }
        seen.add( cand.required );
        if ( !wouldSplitSrc( cand.required ) ) {
          include.push( cand.required );
        }
      }
    }

    return include;
  };

  const files = [];
  const filesByPath = new Map();
  const moduleToFile: Map<Module, FinalAsset> = new Map();

  hashes.forEach( ( hash, m ) => {
    const srcs = grow( m );
    if ( srcs ) {

      const f = {
        id: m.id,
        path: m.path,
        type: m.type,
        index: m.index,
        normalized: m.normalized,
        dest: m.dest,
        relative: m.relative,
        isEntry: m.isEntry,
        srcs: srcs.map( ( { id } ) => id )
      };

      files.push( f );

      const possibleDest = f.dest.replace( reExt, `.${f.type}` );
      const arr = filesByPath.get( possibleDest ) || [];
      arr.push( f );
      filesByPath.set( possibleDest, arr );

      for ( const src of srcs ) {
        moduleToFile.set( src, f );
      }
    }
  } );

  for ( const [ possibleDest, files ] of filesByPath ) {
    if ( files.length === 1 ) {
      const f = files[ 0 ];
      f.dest = possibleDest;
      f.relative = f.relative.replace( reExt, `.${f.type}` );
    } else {
      for ( const f of files ) {
        if ( f.index === -1 ) {
          f.dest = `${f.dest}.${f.type}`;
          f.relative = `${f.relative}.${f.type}`;
        } else {
          f.dest = `${f.dest}.${f.index}.${f.type}`;
          f.relative = `${f.relative}.${f.index}.${f.type}`;
        }
      }
    }
  }

  const moduleToAssets: Map<string, FinalAsset[]> = new Map();
  for ( const [ module, file ] of moduleToFile ) {

    const set: Set<FinalAsset> = new Set( [ file ] );

    for ( const dep of map.syncDeps( module ) ) {
      set.add( get( moduleToFile, dep ) );
    }

    moduleToAssets.set( module.hashId, Array.from( set ).sort() );
  }

  return {
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
