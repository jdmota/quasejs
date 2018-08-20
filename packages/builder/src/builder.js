// @flow
import hash from "./utils/hash";
import { type RuntimeInfo, createRuntime, createRuntimeManifest } from "./runtime/create-runtime";
import Module, { type ModuleArg } from "./modules/index";
import difference from "./utils/difference";
import PluginsRunner from "./plugins/runner";
import type {
  FinalAsset, FinalAssets,
  PerformanceOpts, MinimalFS, ToWrite,
  Info, OptimizationOptions, Options
} from "./types";
import { resolvePath, relative } from "./id";
import { Graph, processGraph } from "./graph";
import FileSystem from "./filesystem";
import Reporter from "./reporter";

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
  +codeFrameOptions: Object;
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
  hmrOptions: ?{
    hostname: string,
    port: number
  };
  prevFiles: ( {
    id: string,
    relative: string,
    hash: string | null
  } )[];

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
    this.codeFrameOptions = options.codeFrameOptions;
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

    this.hmrOptions = null;
    this.prevFiles = [];
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

  createRuntime( info: RuntimeInfo ) {
    return createRuntime( {
      hmr: this.hmrOptions,
      browser: this.options.runtime.browser,
      node: this.options.runtime.node,
      worker: this.options.runtime.worker
    }, info );
  }

  async writeAsset( asset: FinalAsset, { data, map }: ToWrite ): Promise<Info> {

    const fs = this.fs;
    const inlineMap = this.sourceMaps === "inline";
    const directory = path.dirname( asset.dest );

    if ( map ) {
      map.sources = map.sources.map(
        source => relative( resolvePath( source, this.cwd ), directory )
      );
    }

    if ( map && typeof data === "string" ) {
      if ( inlineMap ) {
        map.file = undefined;
        data += `\n//# ${SOURCE_MAP_URL}=${map.toUrl()}`;
      } else {
        data += `\n//# ${SOURCE_MAP_URL}=`;
      }
    }

    let h = null;
    if ( this.hashing && !asset.isEntry ) {
      h = hash( data );
      asset.dest = addHash( asset.dest, h );
      asset.relative = addHash( asset.relative, h );
      if ( map && !inlineMap ) {
        map.file = addHash( map.file, h );
      }
    }

    if ( h == null && this.options.hmr ) {
      h = hash( data );
    }

    asset.hash = h;

    await fs.mkdirp( directory );

    if ( map && typeof data === "string" ) {
      if ( inlineMap ) {
        await fs.writeFile( asset.dest, data );
      } else {
        const p1 = fs.writeFile( asset.dest, data + `${path.basename( asset.dest )}.map` );
        const p2 = fs.writeFile( asset.dest + ".map", map.toString() );
        await p1;
        await p2;
      }
    } else {
      await fs.writeFile( asset.dest, data );
    }

    return {
      file: asset.dest,
      hash: h,
      size: data.length,
      isEntry: asset.isEntry
    };
  }

  async writeCode( asset: { dest: string, code: string } ): Promise<Info> {
    await this.fs.mkdirp( path.dirname( asset.dest ) );
    await this.fs.writeFile( asset.dest, asset.code );
    return {
      file: asset.dest,
      hash: null,
      size: asset.code.length,
      isEntry: false
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
      let runtime;
      if ( asset.isEntry ) {
        runtime = asset.runtime = {
          dest: `${asset.dest}.runtime.js`,
          relative: `${asset.relative}.runtime.js`,
          code: await this.createRuntime( {
            context: this.dest,
            fullPath: asset.dest,
            publicPath: this.publicPath,
            finalAssets
          } )
        };
      }

      const out = await this.pluginsRunner.renderAsset( asset, finalAssets );
      if ( out ) {
        writes.push( this.writeAsset( asset, out ) );
        if ( runtime && this.options.hmr ) {
          writes.push( this.writeCode( runtime ) );
        }
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

    const swFile = this.serviceWorker.filename;

    if ( swFile ) {
      const swPrecache = require( "sw-precache" );
      const serviceWorkerCode = await swPrecache.generate( this.serviceWorker );

      await fs.outputFile( swFile, serviceWorkerCode );

      filesInfo.push( {
        file: swFile,
        hash: null,
        size: serviceWorkerCode.length,
        isEntry: false
      } );
    }

    let update;

    if ( this.options.hmr ) {
      const newFiles = finalAssets.files.map( ( { id, relative, hash, isEntry } ) => ( { id, relative, hash, isEntry } ) );

      const filesDifference = difference( this.prevFiles, newFiles, ( a, b ) => {
        return a.id === b.id && a.relative === b.relative && a.hash === b.hash && a.isEntry === b.isEntry;
      } );

      this.prevFiles = newFiles;

      update = {
        manifest: createRuntimeManifest( finalAssets ),
        ids: filesDifference.map( ( { id } ) => id ),
        files: filesDifference.map( ( { relative } ) => relative ),
        reloadApp: filesDifference.some( ( { isEntry } ) => isEntry )
      };
    }

    const out = {
      filesInfo,
      time: Date.now() - startTime,
      update
    };

    await this.pluginsRunner.afterBuild( finalAssets, out );

    return out;
  }

}

function addHash( file: string, h: string ): string {
  const fn = m => ( m ? `.${h}` + m : `-${h}` );
  return file.replace( rehash, fn );
}
