import hash from "./utils/hash";
import { RuntimeInfo, createRuntime, createRuntimeManifest } from "./runtime/create-runtime";
import Module, { ModuleArg } from "./module";
import { PluginsRunnerInWorker, PluginsRunner } from "./plugins/runner";
import { ComputationApi, ComputationCancelled } from "./utils/data-dependencies";
import { resolvePath, relative } from "./utils/path";
import { BuilderContext } from "./plugins/context";
import { WatchedFiles, FinalAsset, ToWrite, Info, Options } from "./types";
import { Graph, processGraph } from "./graph";
import Reporter from "./reporter";
import { Farm } from "./workers/farm";
import Watcher from "./watcher";

const fs = require( "fs-extra" );
const path = require( "path" );
const EventEmitter = require( "events" );
const { getOnePlugin } = require( "@quase/get-plugins" );

const SOURCE_MAP_URL = "source" + "MappingURL"; // eslint-disable-line
const rehash = /(\..*)?$/;

function addHash( file: string, h: string ): string {
  return file.replace( rehash, m => ( m ? `.${h}` + m : `-${h}` ) );
}

export class Build {

  builder: Builder; // eslint-disable-line no-use-before-define
  promises: Promise<unknown>[];
  buildId: number;
  graph: Graph;
  cancelled: boolean;
  summary: Map<string, {
    id: string;
    lastChangeId: number;
    file: string;
    fileIsEntry: boolean;
  }>;

  constructor( prevBuild: Build|null, builder: Builder ) {
    this.builder = builder;
    this.promises = [];
    this.graph = new Graph();
    this.cancelled = false;

    if ( prevBuild ) {
      for ( const module of prevBuild.graph.modules.values() ) {
        this.graph.add( module );
      }
      this.buildId = prevBuild.buildId + 1;
      // If a build fails, don't lose the summary of the last successful build
      this.summary = prevBuild.summary;
    } else {
      this.buildId = 0;
      this.summary = new Map();
    }
  }

  exists( id: string ): boolean {
    return this.graph.modules.has( id );
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

  addModuleAndTransform( arg: ModuleArg, importer: Module|null, typeTransforms: ReadonlyArray<string>|null ): Module {
    return this.transformModuleType( this.addModule( arg ), importer, typeTransforms );
  }

  transformModuleType( startModule: Module, importer: Module|null, typeTransforms: ReadonlyArray<string>|null ): Module {

    let m = startModule;
    const generation =
      typeTransforms ||
      this.builder.pluginsRunner.getTypeTransforms( m.ctx, importer && importer.ctx );

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

export default class Builder extends EventEmitter {

  options: Options;
  reporter: { plugin: any; options: any };
  context: BuilderContext;
  farm: Farm;
  pluginsRunner: PluginsRunner;
  watcher: Watcher | null;
  worker: PluginsRunnerInWorker | null;
  hmrOptions: {
    hostname: string;
    port: number;
  } | null;
  build: Build;

  constructor( options: Options ) {
    super();

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

    serviceWorker.staticFileGlobs = serviceWorker.staticFileGlobs.map( ( p: string ) => path.join( dest, p ) );
    serviceWorker.stripPrefixMulti[ `${dest}${path.sep}`.replace( /\\/g, "/" ) ] = publicPath;
    serviceWorker.filename = serviceWorker.filename ? resolvePath( serviceWorker.filename, dest ) : "";

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

    this.watcher = watch ? new Watcher( this ) : null;
    this.worker = null;
  }

  warn( warning: any ) {
    this.emit( "warning", warning );
  }

  getWorker() {
    const { worker } = this;
    if ( worker ) {
      return worker;
    }
    throw new Error( "Assertion error" );
  }

  registerFiles<T>( files: WatchedFiles, computation: ComputationApi<T> ) {
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
        ( source: string ) => relative( resolvePath( source, this.options.cwd ), directory )
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
      if ( !inlineMap && map && typeof map.file === "string" ) {
        map.file = addHash( map.file, h );
      }
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

  async writeCode( asset: { relativeDest: string; code: string } ): Promise<Info> {
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

  async callRenderers( finalAssets: FinalAsset[] ): Promise<Info[]> {
    const writes = [];
    for ( const asset of finalAssets ) {
      const manifest = createRuntimeManifest( asset.manifest );

      if ( asset.isEntry ) {
        const code = await this.createRuntime( {
          context: this.options.dest,
          fullPath: path.join( this.options.dest, asset.relativeDest ),
          publicPath: this.options.publicPath,
          minify: this.options.mode !== "development"
        } );
        asset.runtime = {
          manifest,
          code
        };
      } else {
        asset.runtime.manifest = manifest;
      }

      const out = await this.pluginsRunner.renderAsset( asset, new BuilderContext( this.options ) );
      if ( out ) {
        writes.push( this.writeAsset( asset, out ) );
      } else {
        throw new Error( `Could not build asset ${asset.normalized}` );
      }
    }
    return Promise.all( writes );
  }

  stop() {
    this.farm.stop();
    const { watcher } = this;
    if ( watcher ) {
      watcher.stop();
    }
  }

  async runBuild() {
    this.build.cancel();
    const build = this.build = new Build( this.build, this );

    if ( !this.worker ) {
      this.worker = await this.farm.setup();
    }

    const startTime = Date.now();
    const emptyDirPromise =
      this.options.optimization.cleanup ? fs.emptyDir( this.options.dest ) : Promise.resolve();

    for ( const path of this.options.entries ) {
      build.graph.addEntry(
        build.addModuleAndTransform( {
          path,
          prevId: null,
          type: this.pluginsRunner.getType( path ),
          loc: null,
          builder: this
        }, null, null )
      );
    }

    await build.wait();

    build.graph.init( this );

    await this.pluginsRunner.check( build.graph );

    const processedGraph = await this.pluginsRunner.graphTransform( processGraph( build.graph ) );

    await emptyDirPromise;

    const { dotGraph } = this.options;
    if ( dotGraph ) {
      await build.graph.dumpDotGraph( path.resolve( this.options.dest, dotGraph ) );
    }

    const filesInfo = await this.callRenderers( processedGraph.files );

    const swFile = this.options.serviceWorker.filename;

    if ( swFile ) {
      const swPrecache = require( "sw-precache" );
      const serviceWorkerCode = await swPrecache.generate( {
        ...this.options.serviceWorker,
        logger: () => {}
      } );

      await fs.outputFile( swFile, serviceWorkerCode );

      filesInfo.push( {
        file: swFile,
        hash: null,
        size: serviceWorkerCode.length,
        isEntry: false
      } );
    }

    let updates;

    if ( this.options.hmr ) {
      const previousSummary = build.summary;
      const newSummary = new Map();
      updates = [];

      for ( const [ id, m ] of build.graph.modules ) {
        const file = processedGraph.moduleToFile.get( m );
        if ( !file ) throw new Error( "Assertion error" );

        const requiredAssets = build.graph.requiredAssets(
          m,
          processedGraph.moduleToFile
        ).map( a => a.relativeDest );

        const data = {
          id,
          lastChangeId: m.lastChangeId,
          file: file.relativeDest,
          fileIsEntry: file.isEntry
        };

        newSummary.set( id, data );

        const inPrevSummary = previousSummary.get( id );
        if ( !inPrevSummary ) {
          updates.push( {
            id,
            file: data.file,
            prevFile: null,
            reloadApp: data.fileIsEntry,
            requiredAssets
          } );
        } else if ( inPrevSummary.lastChangeId !== data.lastChangeId ) {
          updates.push( {
            id,
            file: data.file,
            prevFile: inPrevSummary.file,
            reloadApp: inPrevSummary.fileIsEntry || data.fileIsEntry,
            requiredAssets
          } );
        }
      }

      for ( const [ id, inPrevSummary ] of previousSummary ) {
        if ( !newSummary.has( id ) ) {
          updates.push( {
            id,
            file: null,
            prevFile: inPrevSummary.file,
            reloadApp: inPrevSummary.fileIsEntry
          } );
        }
      }

      build.summary = newSummary;
    }

    return {
      filesInfo,
      time: Date.now() - startTime,
      updates
    };
  }

}
