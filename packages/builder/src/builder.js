// @flow
import hash from "./utils/hash";
import { type RuntimeInfo, createRuntime, createRuntimeManifest } from "./runtime/create-runtime";
import Module, { type ModuleArg } from "./module";
import type { PluginsRunnerInWorker, PluginsRunner } from "./plugins/runner";
import { type ComputationApi, ComputationCancelled } from "./utils/data-dependencies";
import difference from "./utils/difference";
import { resolvePath, relative } from "./utils/path";
import { BuilderContext } from "./plugins/context";
import type { WatchedFiles, FinalAsset, FinalAssets, ToWrite, Info, Options } from "./types";
import { Graph, processGraph } from "./graph";
import Reporter from "./reporter";
import { Farm } from "./workers/farm";
import Watcher from "./watcher";

const fs = require( "fs-extra" );
const path = require( "path" );
const { getOnePlugin } = require( "@quase/get-plugins" );

const SOURCE_MAP_URL = "source" + "MappingURL"; // eslint-disable-line
const rehash = /(\..*)?$/;

function addHash( file: string, h: string ): string {
  const fn = m => ( m ? `.${h}` + m : `-${h}` );
  return file.replace( rehash, fn );
}

export class Build {

  +builder: Builder; // eslint-disable-line no-use-before-define
  +promises: Promise<*>[];
  +buildId: number;
  +graph: Graph;
  cancelled: boolean;
  prevFiles: ( {
    id: string,
    relativeDest: string,
    hash: string | null
  } )[];

  constructor( prevBuild: ?Build, builder: Builder ) {
    this.builder = builder;
    this.promises = [];
    this.graph = new Graph();
    this.cancelled = false;

    if ( prevBuild ) {
      for ( const module of prevBuild.graph.modules.values() ) {
        this.graph.add( module );
      }

      this.buildId = prevBuild.buildId + 1;
      this.prevFiles = prevBuild.prevFiles;
    } else {
      this.buildId = 0;
      this.prevFiles = [];
    }
  }

  removeOrphans() {
    if ( this.cancelled ) {
      throw new ComputationCancelled();
    }

    const removed = [];

    for ( const module of this.graph.modules.values() ) {
      if ( module.buildId !== this.buildId ) {
        removed.push( module );
      }
    }

    for ( const module of removed ) {
      this.graph.remove( module );
    }
  }

  addModule( arg: ModuleArg ): Module {
    if ( this.cancelled ) {
      throw new ComputationCancelled();
    }

    const id = this.builder.makeId( arg );
    let m = this.graph.modules.get( id );

    if ( !m ) {
      m = new Module( id, arg );
      this.graph.add( m );
    }

    this.promises.push( m.process( this ) );
    return m;
  }

  process( module: Module ) {
    if ( this.cancelled ) {
      throw new ComputationCancelled();
    }

    this.promises.push( module.process( this ) );
  }

  addModuleAndTransform( arg: ModuleArg, importer: ?Module ): Module {
    return this.transformModuleType( this.addModule( arg ), importer );
  }

  transformModuleType( startModule: Module, importer: ?Module ): Module {

    let m = startModule;
    const generation = this.builder.pluginsRunner.getTypeTransforms( m.ctx, importer && importer.ctx );

    for ( let i = 0; i < generation.length; i++ ) {
      if ( m.type === generation[ i ] ) {
        continue;
      }
      m = m.newModuleType( this, generation[ i ] );
    }

    return m;
  }

  async wait() {
    let promise;
    while ( promise = this.promises.pop() ) {
      await promise;
    }

    this.removeOrphans();
  }

  cancel() {
    this.cancelled = true;
  }

  isActive(): boolean {
    return !this.cancelled;
  }

  isCancelled(): boolean {
    return this.cancelled;
  }

}

export default class Builder {

  +options: Options;
  +warn: Function;
  +reporter: { +plugin: Function, +options: Object };
  +context: BuilderContext;
  +farm: Farm;
  +pluginsRunner: PluginsRunner;
  +watcher: ?Watcher;
  worker: PluginsRunnerInWorker;
  hmrOptions: ?{
    hostname: string,
    port: number
  };
  build: Build;

  constructor( options: Options, warn: Function ) {

    const cwd = path.resolve( options.cwd ),
        context = resolvePath( options.context, cwd ),
        dest = resolvePath( options.dest, cwd ),
        entries = options.entries.map( e => resolvePath( e, context ) ),
        publicPath = options.publicPath ? options.publicPath.replace( /\/+$/, "" ) + "/" : "",
        { watch, optimization, reporter, serviceWorker } = options;

    this.options = {
      ...options,
      ...{
        cwd,
        context,
        dest,
        entries,
        publicPath
      }
    };

    if ( watch ) {
      optimization.hashId = false;
    }

    serviceWorker.staticFileGlobs = serviceWorker.staticFileGlobs.map( p => path.join( dest, p ) );
    serviceWorker.stripPrefixMulti[ `${dest}${path.sep}`.replace( /\\/g, "/" ) ] = publicPath;
    serviceWorker.filename = serviceWorker.filename ? resolvePath( serviceWorker.filename, dest ) : "";

    this.warn = warn;
    this.reporter = !reporter || reporter === "default" ? Reporter : getOnePlugin( options.reporter );
    this.context = new BuilderContext( this.options );
    this.farm = new Farm( {
      cwd: this.options.cwd,
      plugins: this.options.plugins,
      optimization: this.options.optimization
    } );
    this.pluginsRunner = this.farm.localPluginsRunner;
    this.hmrOptions = null;
    this.build = new Build( null, this );

    if ( watch ) {
      this.watcher = new Watcher( this );
    }
  }

  registerFiles( files: WatchedFiles, computation: ComputationApi ) {
    const { watcher } = this;

    if ( watcher ) {
      for ( const [ file, info ] of files ) {
        watcher.registerFile( file, info, computation );
      }
    }
  }

  makeId( { prevId, path, type, innerId }: ModuleArg ) {
    return prevId ? `${prevId}|${innerId ? `(${innerId},${type})` : type}` : relative( path, this.options.context );
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

    let dest = path.join( this.options.dest, asset.relativeDest );
    const fs = this.options.fs;
    const inlineMap = this.options.optimization.sourceMaps === "inline";
    const directory = path.dirname( dest );

    if ( map ) {
      map.sources = map.sources.map(
        source => relative( resolvePath( source, this.options.cwd ), directory )
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
    if ( this.options.optimization.hashing && !asset.isEntry ) {
      h = hash( data );
      asset.relativeDest = addHash( asset.relativeDest, h );
      dest = path.join( this.options.dest, asset.relativeDest );
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
        await fs.writeFile( dest, data );
      } else {
        const p1 = fs.writeFile( dest, data + `${path.basename( dest )}.map` );
        const p2 = fs.writeFile( dest + ".map", map.toString() );
        await p1;
        await p2;
      }
    } else {
      await fs.writeFile( dest, data );
    }

    return {
      file: dest,
      hash: h,
      size: data.length,
      isEntry: asset.isEntry
    };
  }

  async writeCode( asset: { relativeDest: string, code: string } ): Promise<Info> {
    const dest = path.join( this.options.dest, asset.relativeDest );
    await this.options.fs.mkdirp( path.dirname( dest ) );
    await this.options.fs.writeFile( dest, asset.code );
    return {
      file: dest,
      hash: null,
      size: asset.code.length,
      isEntry: false
    };
  }

  async callRenderers( finalAssets: FinalAssets ): Promise<Info[]> {
    const writes = [];
    for ( const asset of finalAssets.files ) {
      let runtime;
      if ( asset.isEntry ) {
        runtime = asset.runtime = {
          relativeDest: `${asset.relativeDest}.runtime.js`,
          code: await this.createRuntime( {
            context: this.options.dest,
            fullPath: path.join( this.options.dest, asset.relativeDest ),
            publicPath: this.options.publicPath,
            finalAssets
          } )
        };
      }

      const out = await this.pluginsRunner.renderAsset( asset, finalAssets, new BuilderContext( this.options ) );
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

  stop() {
    this.farm.stop();
  }

  async runBuild() {
    this.build.cancel();
    const prevFiles = this.build.prevFiles;
    const build = this.build = new Build( this.build, this );

    if ( !this.worker ) {
      this.worker = await this.farm.setup();
    }

    const startTime = Date.now();
    const emptyDirPromise = this.options.optimization.cleanup ? fs.emptyDir( this.options.dest ) : Promise.resolve();

    for ( const path of this.options.entries ) {
      build.graph.addEntry(
        build.addModuleAndTransform( {
          path,
          prevId: null,
          type: this.pluginsRunner.getType( path ),
          builder: this
        }, null )
      );
    }

    await build.wait();

    build.graph.init( this );

    await this.pluginsRunner.check( build.graph );

    const finalAssets = await this.pluginsRunner.graphTransform( processGraph( build.graph ) );

    await emptyDirPromise;

    const { dotGraph } = this.options;
    if ( dotGraph ) {
      await build.graph.dumpDotGraph( path.resolve( this.options.dest, dotGraph ) );
    }

    const filesInfo = await this.callRenderers( finalAssets );

    const swFile = this.options.serviceWorker.filename;

    if ( swFile ) {
      const swPrecache = require( "sw-precache" );
      const serviceWorkerCode = await swPrecache.generate( this.options.serviceWorker );

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
      const newFiles = finalAssets.files.map( ( { id, relativeDest, hash, isEntry } ) => ( { id, relativeDest, hash, isEntry } ) );

      const filesDifference = difference( prevFiles, newFiles, ( a, b ) => {
        return a.id === b.id && a.relativeDest === b.relativeDest && a.hash === b.hash && a.isEntry === b.isEntry;
      } );

      build.prevFiles = newFiles;

      update = {
        manifest: createRuntimeManifest( finalAssets ),
        ids: filesDifference.map( ( { id } ) => id ),
        files: filesDifference.map( ( { relativeDest } ) => relativeDest ),
        reloadApp: filesDifference.some( ( { isEntry } ) => isEntry )
      };
    }

    return {
      filesInfo,
      time: Date.now() - startTime,
      update
    };
  }

}
