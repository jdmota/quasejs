// @flow
import hash from "./utils/hash";
import createRuntime, { type RuntimeArg } from "./runtime/create-runtime";
import processGraph from "./graph";
import type {
  FinalAsset, FinalAssets,
  PerformanceOpts, MinimalFS, ToWrite,
  Info, OptimizationOptions, Options
} from "./types";
import { resolvePath, relative, lowerPath } from "./id";
import TrackableFileSystem from "./filesystem";
import Reporter from "./reporter";
import Module, { type ModuleArg } from "./module";
import { type RequirerInfo } from "./module-utils";
import PluginsRunner from "./plugins/runner";

const fs = require( "fs-extra" );
const path = require( "path" );
const { getOnePlugin } = require( "@quase/get-plugins" );

const SOURCE_MAP_URL = "source" + "MappingURL"; // eslint-disable-line
const rehash = /(\..*)?$/;

type ModuleRefs = {
  byParent: Map<Module, Set<Module>>,
  byDep: Map<Module, Set<Module>>
};

const refLocations: Set<$Keys<ModuleRefs>> = new Set( [ "byParent", "byDep" ] );

export default class Builder {

  +options: Options;
  +entries: string[];
  +context: string;
  +dest: string;
  +cwd: string;
  +sourceMaps: boolean | "inline";
  +hashing: boolean;
  +publicPath: string;
  +warn: Function;
  +fileSystem: TrackableFileSystem<RequirerInfo>;
  +fs: MinimalFS;
  +cli: Object;
  +reporter: { +plugin: Function, +options: Object };
  +watch: boolean;
  +watchOptions: ?Object;
  +pluginsRunner: PluginsRunner;
  +optimization: OptimizationOptions;
  +performance: PerformanceOpts;
  +serviceWorker: Object;
  +cleanBeforeBuild: boolean;
  +modules: Map<string, Module>;
  +modulesPerFile: Map<string, Set<Module>>;
  +moduleEntries: Set<Module>;
  +usedIds: Set<string>;
  +promises: Promise<*>[];
  +refs: ModuleRefs;

  constructor( options: Options, warn: Function ) {

    this.options = options;
    this.cwd = path.resolve( options.cwd );
    this.context = resolvePath( options.context, this.cwd );
    this.dest = resolvePath( options.dest, this.cwd );
    this.entries = options.entries.map( e => resolvePath( e, this.context ) );
    this.publicPath = ( options.publicPath || "/" ).replace( /\/+$/, "" ) + "/";
    this.reporter = getOnePlugin( options.reporter, x => ( x === "default" ? Reporter : x ) );
    this.fs = options.fs;
    this.optimization = options.optimization;
    this.sourceMaps = options.optimization.sourceMaps;
    this.hashing = options.optimization.hashing;
    this.cleanBeforeBuild = options.optimization.cleanup;
    this.cli = options.cli;
    this.watch = options.watch;
    this.watchOptions = options.watchOptions;
    this.performance = options.performance;
    this.fileSystem = new TrackableFileSystem();
    this.warn = warn;

    if ( this.watch ) {
      this.optimization.hashId = false;
    }

    this.pluginsRunner = new PluginsRunner( this, options.plugins );

    this.serviceWorker = options.serviceWorker;
    this.serviceWorker.staticFileGlobs = this.serviceWorker.staticFileGlobs.map( p => path.join( this.dest, p ) );
    this.serviceWorker.stripPrefixMulti[ `${this.dest}${path.sep}`.replace( /\\/g, "/" ) ] = this.publicPath;
    this.serviceWorker.filename = this.serviceWorker.filename ? resolvePath( this.serviceWorker.filename, this.dest ) : "";

    this.modules = new Map();
    this.modulesPerFile = new Map();
    this.moduleEntries = new Set();
    this.usedIds = new Set();

    this.promises = [];

    this.refs = {
      byParent: new Map(),
      byDep: new Map()
    };
  }

  addRef( _from: Module, to: Module, where: $Keys<ModuleRefs> ) {
    const map = this.refs[ where ];
    const set = map.get( to ) || new Set();
    map.set( to, set );
    set.add( _from );
  }

  removeRef( _from: Module, to: Module, where: $Keys<ModuleRefs> ) {
    const map = this.refs[ where ];
    const set = map.get( to );
    if ( set ) {
      set.delete( _from );
    }
  }

  destroyRefsTo( to: Module ) {
    for ( const loc of refLocations ) {
      const map = this.refs[ loc ];
      const set = map.get( to );
      if ( set ) {
        map.delete( to );
        for ( const _from of set ) {
          switch ( loc ) {
            case "PARENT":
              this.removeModule( _from );
              break;
            case "MODULE_DEPS":
              _from.resetDeps( this );
              break;
            default:
          }
        }
      }
    }
  }

  createFakePath( key: string ): string {
    return resolvePath( `_quase_builder_/${key}`, this.context );
  }

  isFakePath( path: string ): boolean {
    return path.startsWith( resolvePath( "_quase_builder_", this.context ) );
  }

  isEntry( id: string ): boolean {
    return this.entries.findIndex( e => e === id ) > -1;
  }

  isDest( id: string ): boolean {
    return id.indexOf( this.dest ) === 0;
  }

  getModuleForSure( id: string ): Module {
    const m = this.modules.get( id );
    if ( m ) {
      return m;
    }
    throw new Error( `Internal: cannot find module ${id}` );
  }

  makeId( { path, type, index }: ModuleArg ) {
    if ( index === -1 && path.endsWith( `.${type}` ) ) {
      return relative( path, this.context );
    }
    return `${relative( path, this.context )}\0${index}\0${type}`;
  }

  addModule( arg: ModuleArg ): Module {
    const id = this.makeId( arg );
    let m = this.modules.get( id );

    if ( !m ) {
      m = new Module( id, arg );
      this.modules.set( id, m );

      const set = this.modulesPerFile.get( m.path ) || new Set();
      set.add( m );
      this.modulesPerFile.set( m.path, set );

      if ( m.isEntry ) {
        this.moduleEntries.add( m );
      }
    }

    this.promises.push( m.process( this ) );
    return m;
  }

  addModuleAndTransform( arg: ModuleArg, importer: ?Module ): Module {
    return this.transformModuleType( this.addModule( arg ), importer );
  }

  transformModuleType( startModule: Module, importer: ?Module ): Module {

    let m = startModule;
    const generation = this.pluginsRunner.getTypeTransforms( m.utils, importer && importer.utils );

    for ( let i = 0; i < generation.length; i++ ) {
      if ( m.type === generation[ i ] ) {
        continue;
      }
      m = m.newModuleType( this, generation[ i ] );
    }

    return m;
  }

  removeModule( m: Module ) {
    if ( this.modules.delete( m.id ) ) {
      this.usedIds.delete( m.hashId );

      if ( m.isEntry ) {
        this.moduleEntries.delete( m );
      }

      const modules = this.modulesPerFile.get( m.path );
      if ( modules ) modules.delete( m );

      this.destroyRefsTo( m );
    }
  }

  resetDeps( path: string ) {
    const modules = this.modulesPerFile.get( path );
    if ( modules ) {
      modules.forEach( m => m.resetDeps( this ) );
    }
  }

  removeFile( path: string, removed: boolean ) {
    path = lowerPath( path );

    const modules = this.modulesPerFile.get( path );
    if ( modules ) {
      this.modulesPerFile.delete( path );
      for ( const m of modules ) {
        this.removeModule( m );
      }
    }

    const set = this.fileSystem.fileUsedBy.get( path );
    if ( set ) {
      set.forEach( ( { who, when, what } ) => {
        if ( what === "stat" && when === "resolve" ) {
          who.resetDeps( this );
        } else {
          this.removeModule( who );
        }
      } );
    }

    if ( removed ) {
      this.fileSystem.purge( path );
    } else {
      this.fileSystem.purgeContent( path );
    }
  }

  createRuntime( obj: RuntimeArg ) {
    return createRuntime( obj );
  }

  async write( asset: FinalAsset, { data, map }: ToWrite ): Promise<Info> {

    let h;
    if ( this.hashing && !asset.isEntry ) {
      h = hash( data );
      asset.dest = addHash( asset.dest, h );
      asset.relative = addHash( asset.relative, h );
      if ( map ) {
        map.file = addHash( map.file, h );
      }
    }

    const fs = this.fs;
    const inlineMap = this.sourceMaps === "inline";
    const destPath = asset.dest;
    const directory = path.dirname( destPath );

    if ( map ) {
      map.sources = map.sources.map(
        source => relative( resolvePath( source, this.cwd ), directory )
      );
    }

    await fs.mkdirp( path.dirname( destPath ) );

    if ( map && typeof data === "string" ) {
      if ( inlineMap ) {
        await fs.writeFile( destPath, data + `\n//# ${SOURCE_MAP_URL}=${map.toUrl()}` );
      } else {
        const p1 = fs.writeFile( destPath, data + `\n//# ${SOURCE_MAP_URL}=${path.basename( destPath )}.map` );
        const p2 = fs.writeFile( destPath + ".map", map.toString() );
        await p1;
        await p2;
      }
    } else {
      await fs.writeFile( destPath, data );
    }

    return {
      file: asset.dest,
      size: data.length,
      isEntry: asset.isEntry
    };
  }

  async callRenderers( finalAssets: FinalAssets ): Promise<Info[]> {
    const writes = [];
    for ( const asset of finalAssets.files ) {
      const out = await this.pluginsRunner.renderAsset( asset, finalAssets );
      if ( out ) {
        writes.push( this.write( asset, out ) );
        continue;
      }
      throw new Error( `Could not build asset ${asset.normalized}` );
    }
    return Promise.all( writes );
  }

  async build() {
    const startTime = Date.now();
    const emptyDirPromise = this.cleanBeforeBuild ? fs.emptyDir( this.dest ) : Promise.resolve();

    for ( const path of this.entries ) {
      this.addModuleAndTransform( {
        path,
        type: this.pluginsRunner.getType( path ),
        index: -1,
        isEntry: true,
        builder: this
      }, null );
    }

    let promise;
    while ( promise = this.promises.pop() ) {
      await promise;
    }

    await this.pluginsRunner.check();

    const finalAssets = await this.pluginsRunner.graphTransform( processGraph( this ) );

    await emptyDirPromise;

    const filesInfo = await this.callRenderers( finalAssets );

    if ( this.serviceWorker.filename ) {
      const swPrecache = require( "sw-precache" );
      const serviceWorkerCode = await swPrecache.generate( this.serviceWorker );

      await fs.outputFile( this.serviceWorker.filename, serviceWorkerCode );

      filesInfo.push( {
        file: this.serviceWorker.filename,
        size: serviceWorkerCode.length,
        isEntry: false
      } );
    }

    const out = {
      filesInfo,
      time: Date.now() - startTime
    };

    await this.pluginsRunner.afterBuild( out );

    return out;
  }

}

function addHash( file: string, h: string ): string {
  const fn = m => ( m ? `.${h}` + m : `-${h}` );
  return file.replace( rehash, fn );
}
