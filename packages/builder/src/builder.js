// @flow
import hash from "./utils/hash";
import createRuntime, { type RuntimeArg } from "./runtime/create-runtime";
import Module, { type ModuleArg } from "./modules/index";
import type {
  FinalAsset, FinalAssets,
  PerformanceOpts, MinimalFS, ToWrite,
  Info, OptimizationOptions, Options
} from "./types";
import { resolvePath, relative } from "./id";
import { Graph, processGraph } from "./graph";
import FileSystem from "./filesystem";
import Reporter from "./reporter";
import PluginsRunner from "./plugins/runner";

const fs = require( "fs-extra" );
const path = require( "path" );
const { getOnePlugin } = require( "@quase/get-plugins" );
const { joinSourceMaps } = require( "@quase/source-map" );

const SOURCE_MAP_URL = "source" + "MappingURL"; // eslint-disable-line
const rehash = /(\..*)?$/;

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
  +fileSystem: FileSystem;
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
  +promises: Promise<*>[];
  buildId: number;

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
    this.fileSystem = new FileSystem();
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

    this.promises = [];
    this.buildId = 0;
  }

  createFakePath( key: string ): string {
    return resolvePath( `_quase_builder_/${key}`, this.context );
  }

  isFakePath( path: string ): boolean {
    return path.startsWith( resolvePath( "_quase_builder_", this.context ) );
  }

  isDest( id: string ): boolean {
    return id.indexOf( this.dest ) === 0;
  }

  makeId( { path, type, innerId }: ModuleArg ) {
    const r = relative( path, this.context );
    if ( innerId || !path.endsWith( `.${type}` ) || /\|/.test( r ) ) {
      return `${r}|${innerId || ""}|${type}`;
    }
    return r;
  }

  addModule( arg: ModuleArg ): Module {
    const id = this.makeId( arg );
    let m = this.modules.get( id );

    if ( !m ) {
      m = new Module( id, arg );
      this.modules.set( id, m );
    }

    this.promises.push( m.process() );
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
      m = m.newModuleType( generation[ i ] );
    }

    return m;
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

  joinSourceMaps( maps: ( ?Object )[] ) {
    return joinSourceMaps( maps );
  }

  wrapInJsPropKey( string: string ): string {
    return /^[$_a-zA-Z][$_a-zA-Z0-9]*$/.test( string ) ? string : JSON.stringify( string );
  }

  wrapInJsString( string: string ): string {
    return /("|'|\\)/.test( string ) ? JSON.stringify( string ) : `'${string}'`;
  }

  renderAsset( asset: FinalAsset, finalAssets: FinalAssets ): Promise<ToWrite> {
    return this.pluginsRunner.renderAsset( asset, finalAssets );
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

  removeModule( m: Module ) {
    this.modules.delete( m.id );
  }

  async build() {
    const startTime = Date.now();
    const emptyDirPromise = this.cleanBeforeBuild ? fs.emptyDir( this.dest ) : Promise.resolve();
    const moduleEntries = new Set();

    this.buildId++;

    for ( const path of this.entries ) {
      moduleEntries.add(
        this.addModuleAndTransform( {
          path,
          type: this.pluginsRunner.getType( path ),
          builder: this
        }, null )
      );
    }

    let promise;
    while ( promise = this.promises.pop() ) {
      await promise;
    }

    const remove = [];
    for ( const module of this.modules.values() ) {
      if ( module.buildId !== this.buildId ) {
        remove.push( module );
      }
    }

    for ( const module of remove ) {
      this.removeModule( module );
    }

    const graph = new Graph( this, moduleEntries );
    await graph.init( this );

    await this.pluginsRunner.check( graph );

    const finalAssets = await this.pluginsRunner.graphTransform( processGraph( graph ) );

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
