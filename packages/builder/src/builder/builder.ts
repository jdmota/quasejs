import { Options, WatchedFiles, Updates, Loc, Checker, ICheckerImpl, Transforms, Output, FinalModule } from "../types";
import { resolvePath, makeAbsolute } from "../utils/path";
import { Time } from "../utils/time";
import { PluginsRunnerLocal } from "../plugins/local-runner";
import Watcher from "./watcher";
import { BuilderUtil } from "../plugins/context";
import { processGraph } from "./graph";
import { UserConfig } from "./user-config";
import { createError } from "../utils/error";
import { PluginRegistry } from "../plugins/plugin-registry";
import EventEmitter from "events";
import { BuilderTransformResolve } from "./builder-transform-resolve";
import { BuilderPack } from "./builder-pack";
import { Module } from "../module/module";
import { getOnePlugin } from "@quase/get-plugins";
import path from "path";
import fs from "fs-extra";
import { Computation } from "../utils/computation-registry";
import { BuildCancelled } from "./build-cancelled";

export class Builder extends EventEmitter {

  options: Options;
  userConfig: UserConfig;
  context: string;
  hmrOptions: {
    hostname: string;
    port: number;
  } | null;
  util: BuilderUtil;
  pluginsRunner: PluginsRunnerLocal;
  pluginsRunnerInit: Promise<void>;

  watcher: Watcher | null;
  reporter: { plugin: any; options: any };

  actualCheckers: ICheckerImpl[];
  buildId: number;

  private checkers: PluginRegistry<Checker>;
  private checkersInit: Promise<void>;
  private time: Time;
  private builderTransformResolve: BuilderTransformResolve;
  private builderPack: BuilderPack;
  private summary: Map<string, {
    id: string;
    lastChangeId: number;
    file: string;
    fileIsEntry: boolean;
  }>;

  constructor( options: Options, testing?: boolean ) {
    super();

    const cwd = makeAbsolute( options.cwd ),
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

    this.context = context;

    if ( watch ) {
      optimization.hashId = false;
    }

    serviceWorker.staticFileGlobs = serviceWorker.staticFileGlobs.map( ( p: string ) => path.join( dest, p ) );
    serviceWorker.stripPrefixMulti[ `${dest}${path.sep}`.replace( /\\/g, "/" ) ] = publicPath;
    serviceWorker.filename = serviceWorker.filename ? resolvePath( serviceWorker.filename, dest ) : "";

    this.util = new BuilderUtil( this.options );

    this.reporter = getOnePlugin( reporter );

    this.watcher = watch ? new Watcher( this, testing ) : null;

    this.userConfig = new UserConfig( {
      cwd: this.options.cwd,
      resolvers: this.options.resolvers,
      transformers: this.options.transformers,
      checkers: this.options.checkers,
      packagers: this.options.packagers,
      optimization: this.options.optimization
    } );

    this.pluginsRunner = new PluginsRunnerLocal( this.userConfig );
    this.pluginsRunnerInit = this.pluginsRunner.init();

    const callbacks = {
      warn: this.warn.bind( this ),
      error: this.error.bind( this )
    };

    this.actualCheckers = [];
    this.checkers = new PluginRegistry();
    this.checkersInit = this.checkers.init( this.userConfig.checkers, this.userConfig.cwd ).then( () => {
      this.actualCheckers = this.checkers.list().map(
        ( { options, plugin } ) => plugin.checker( options, callbacks )
      );
    } );

    this.hmrOptions = null;

    this.time = new Time();
    this.summary = new Map();
    this.buildId = 0;

    this.builderTransformResolve = new BuilderTransformResolve( this );
    this.builderPack = new BuilderPack( this );
  }

  warn( warning: any ) {
    // @ts-ignore
    this.emit( "warning", warning );
  }

  error( id: string, message: string, code: string | null, loc: Loc | null ) {
    throw this.createError( id, message, code, loc );
  }

  createError( id: string, message: string, code: string | null, loc: Loc | null ) {
    return createError( {
      message,
      id,
      code,
      loc,
      codeFrameOptions: this.options.codeFrameOptions,
      noStack: true
    } );
  }

  subscribeFiles( files: WatchedFiles, sub: Computation<any> ) {
    const { watcher } = this;

    if ( watcher ) {
      for ( const [ file, info ] of files ) {
        this.builderTransformResolve.subscribeFile( file, info, sub );
      }
    }
  }

  change( what: string, type: "added" | "changed" | "removed" ) {
    this.builderTransformResolve.change( what, type );
  }

  watchedFiles() {
    return this.builderTransformResolve.watchedFiles();
  }

  stop() {
    this.cancelBuild();
    this.pluginsRunner.stopFarm();
    const { watcher } = this;
    if ( watcher ) {
      watcher.stop();
    }
  }

  addModule( path: string, transforms: Transforms ) {
    return this.builderTransformResolve.addModule(
      path, transforms
    ).id;
  }

  addInnerModule( innerId: string, parentInner: Module, transforms: Transforms ) {
    return this.builderTransformResolve.addInnerModule(
      innerId, parentInner, transforms
    ).id;
  }

  notifyCheckers( module: FinalModule ) {
    for ( const checker of this.actualCheckers ) {
      checker.newModule( module );
    }
  }

  removeModuleById( id: string ) {
    this.builderTransformResolve.removeModuleById( id );
  }

  private checkIfCancelled( buildId: number ) {
    if ( this.buildId !== buildId ) {
      throw new BuildCancelled();
    }
  }

  private wait<T>( buildId: number, p: Promise<T> ) {
    this.checkIfCancelled( buildId );
    return p;
  }

  async cancelBuild() {
    this.buildId = this.buildId + 1;
    this.builderTransformResolve.interrupt();
  }

  // Pre-condition: "cancelPreviousBuild" must be called and previous "runBuild" needs to finish
  async runBuild(): Promise<Output> {
    const { buildId } = this;

    this.emit( "status", "Warming up..." );
    this.time.start();

    await this.wait( buildId, this.checkersInit );
    await this.wait( buildId, this.pluginsRunnerInit );

    this.time.checkpoint( "warmup" );
    this.emit( "status", "Building..." );

    const result = await this.wait( buildId, this.builderTransformResolve.run() );

    // TODO show all errors?
    if ( result.errors ) {
      throw result.errors[ 0 ];
    }

    const { graph } = result;
    if ( !graph ) {
      throw new BuildCancelled();
    }

    this.time.checkpoint( "modules processed" );
    this.emit( "status", "Checking..." );

    // Checks
    await this.wait( buildId, Promise.all( this.actualCheckers.map( c => c.check() ) ) );

    this.time.checkpoint( "checking done" );
    this.emit( "status", "Computing graph..." );

    const processedGraph = processGraph( graph );

    this.time.checkpoint( "graph processed" );
    this.emit( "status", "Creating files..." );

    const { dotGraph } = this.options;
    if ( dotGraph ) {
      await this.wait( buildId, graph.dumpDotGraph( path.resolve( this.options.dest, dotGraph ) ) );
    }

    const { filesInfo, removedCount } = await this.wait( buildId, this.builderPack.run( processedGraph ) );

    this.time.checkpoint( "finished rendering" );

    const swFile = this.options.serviceWorker.filename;

    if ( swFile ) {
      const swPrecache = require( "sw-precache" );
      const serviceWorkerCode = await swPrecache.generate( {
        ...this.options.serviceWorker,
        logger: () => {}
      } );

      await fs.outputFile( swFile, serviceWorkerCode );

      filesInfo.push( {
        moduleId: "",
        file: swFile,
        hash: null,
        size: serviceWorkerCode.length,
        isEntry: false
      } );
    }

    const updates: Updates = [];

    if ( this.options.hmr ) {
      const previousSummary = this.summary;
      const newSummary = new Map();

      for ( const [ id, m ] of graph ) {
        const file = processedGraph.moduleToFile.get( m );
        if ( !file ) {
          // Inline assets
          continue;
        }

        const requiredAssets = graph.requiredAssets(
          m,
          processedGraph.moduleToFile
        ).map( a => a.relativeDest );

        const data = {
          id,
          lastChangeId: m.resolvedId,
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
            reloadApp: inPrevSummary.fileIsEntry,
            requiredAssets: []
          } );
        }
      }

      this.summary = newSummary;
    }

    return {
      filesInfo,
      removedCount,
      time: this.time.end(),
      timeCheckpoints: this.time.getCheckpoints(),
      updates
    };
  }

}
