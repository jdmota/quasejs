import { Options, WatchedFiles, Updates, Loc, Checker, ICheckerImpl, Transforms, Output } from "../types";
import { resolvePath, makeAbsolute } from "../utils/path";
import { Time } from "../utils/time";
import { ComputationGet, ComputationCancelled } from "../utils/computation";
import { PluginsRunnerLocal } from "../plugins/local-runner";
import Watcher from "./watcher";
import { BuilderUtil } from "../plugins/context";
import { processGraph, Graph } from "./graph";
import { UserConfig } from "./user-config";
import { error } from "../utils/error";
import { PluginRegistry } from "../plugins/plugin-registry";
import EventEmitter from "events";
import { BuilderTransformResolve } from "./builder-transform-resolve";
import { BuilderPack } from "./builder-pack";
import { Module } from "../module/module";

const fs = require( "fs-extra" );
const path = require( "path" );
const { getOnePlugin } = require( "@quase/get-plugins" );

export class Build {

  id: number;
  promises: Promise<unknown>[];
  pending: Set<string>;
  graph: Graph;

  constructor( id: number ) {
    this.id = id;
    this.graph = new Graph();
    this.promises = [];
    this.pending = new Set();
  }

}

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
  build: Build;

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
    this.build = new Build( 0 );

    this.builderTransformResolve = new BuilderTransformResolve( this );
    this.builderPack = new BuilderPack( this );
  }

  warn( warning: any ) {
    // @ts-ignore
    this.emit( "warning", warning );
  }

  error( id: string, message: string, code: string | null, loc: Loc | null ) {
    error( {
      message,
      id,
      code,
      loc,
      codeFrameOptions: this.options.codeFrameOptions,
      noStack: true
    } );
  }

  registerFiles( files: WatchedFiles, getter: ComputationGet ) {
    const { watcher } = this;

    if ( watcher ) {
      for ( const [ file, info ] of files ) {
        watcher.registerFile( file, info, getter );
      }
    }
  }

  stop() {
    this.cancelBuild();
    this.pluginsRunner.stopFarm();
    const { watcher } = this;
    if ( watcher ) {
      watcher.stop();
    }
  }

  notifyAddModule( buildId: number, path: string, transforms: Transforms ) {
    if ( this.build.id === buildId ) {
      this.builderTransformResolve.addModuleAndTransform(
        this.build, path, transforms
      );
    }
  }

  notifyAddInnerModule( buildId: number, innerId: string, parentInner: Module, transforms: Transforms ) {
    if ( this.build.id === buildId ) {
      this.builderTransformResolve.addInnerModuleAndTransform(
        this.build, innerId, parentInner, transforms
      );
    }
  }

  private checkIfCancelled( build: Build ) {
    if ( this.build !== build ) {
      throw new ComputationCancelled();
    }
  }

  private wait<T>( build: Build, p: Promise<T> ) {
    this.checkIfCancelled( build );
    return p;
  }

  async cancelBuild() {
    this.build = new Build( this.build.id + 1 );
  }

  // Pre-condition: "cancelPreviousBuild" must be called and previous "runBuild" needs to finish
  async runBuild(): Promise<Output> {
    const { build } = this;

    this.emit( "status", "Warming up..." );
    this.time.start();

    await this.wait( build, this.checkersInit );
    await this.wait( build, this.pluginsRunnerInit );

    const emptyDirPromise =
      this.options.optimization.cleanup ? fs.emptyDir( this.options.dest ) : Promise.resolve();

    this.time.checkpoint( "warmup" );
    this.emit( "status", "Building..." );

    await this.wait( build, this.builderTransformResolve.run( build ) );

    this.time.checkpoint( "modules processed" );
    this.emit( "status", "Checking..." );

    // Checks
    await this.wait( build, Promise.all( this.actualCheckers.map( c => c.check() ) ) );

    this.time.checkpoint( "checking done" );
    this.emit( "status", "Computing graph..." );

    build.graph.init( this.userConfig );
    const processedGraph = processGraph( build.graph );

    this.time.checkpoint( "graph processed" );
    this.emit( "status", "Creating files..." );

    await this.wait( build, emptyDirPromise );

    const { dotGraph } = this.options;
    if ( dotGraph ) {
      await this.wait( build, build.graph.dumpDotGraph( path.resolve( this.options.dest, dotGraph ) ) );
    }

    const filesInfo = await this.wait( build, this.builderPack.run( build, processedGraph ) );

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

      for ( const [ id, m ] of build.graph ) {
        const file = processedGraph.moduleToFile.get( m );
        if ( !file ) {
          // Inline assets
          continue;
        }

        const requiredAssets = build.graph.requiredAssets(
          m,
          processedGraph.moduleToFile
        ).map( a => a.relativeDest );

        const data = {
          id,
          lastChangeId: m.resolvedBuildId,
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
      time: this.time.end(),
      timeCheckpoints: this.time.getCheckpoints(),
      updates
    };
  }

}
