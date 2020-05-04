import { getOnePlugin } from "@quase/get-plugins";
import {
  Options,
  Output,
  BuilderResult,
  BuilderSetupResult,
  BuilderTeardownResult,
} from "../types";
import { typeOf } from "../utils";
import { Time } from "../utils/time";
import {
  throwDiagnostic,
  createDiagnosticFromAny,
  DiagnosticOpts,
  createDiagnostic,
  Diagnostic,
} from "../utils/error";
import { BuilderUtil } from "../plugins/context";
import { Farm } from "../workers/farm";
import { IPluginsRunnerInWorker } from "../plugins/worker-runner";
import { Watcher } from "./watcher";
import { HMRServer } from "./hmr-server";
import { UserConfig } from "./user-config";
import { BuilderHooks, createBuilderHooks } from "./hooks/builder-hooks";
import { BuilderGraph } from "./builder-graph";
import { BuilderEvents } from "./builder-events";
import { install } from "./builder-core-plugin";

const noopPromise = Promise.resolve();

async function catchErr<T>(promise: Promise<T>) {
  try {
    await promise;
  } catch (err) {
    return createDiagnosticFromAny(err);
  }
}

export class PublicBuilder {
  public readonly hooks: BuilderHooks;
  private warnings: Diagnostic[];

  constructor(hooks: BuilderHooks) {
    this.hooks = hooks;
    this.warnings = [];
  }

  warn(warning: unknown) {
    this.warnings.push(createDiagnosticFromAny(warning));
  }

  createDiagnostic(diagnostic: DiagnosticOpts) {
    return createDiagnostic(diagnostic);
  }

  getAndClearWarnings() {
    const { warnings } = this;
    this.warnings = [];
    return warnings;
  }
}

export class Builder extends BuilderEvents {
  public readonly public: PublicBuilder;

  options: Options;
  userConfig: UserConfig;
  util: BuilderUtil;

  private time: Time;
  private summary: Map<
    string,
    {
      id: string;
      file: string;
      fileIsEntry: boolean;
      transformedId: number;
      requires: Set<string>;
    }
  >;

  private builderGraph: BuilderGraph;
  private hooks: BuilderHooks;

  private farm: Farm;
  private worker: IPluginsRunnerInWorker;

  private hmrServer: HMRServer | null;

  private watcher: Watcher | null;
  private filesAdded: Set<string>;
  private filesChanged: Set<string>;
  private filesRemoved: Set<string>;

  private rebuildTimeout: NodeJS.Timeout | null;
  private currentBuild: Promise<BuilderResult> | null;
  private firstBuild: boolean;

  constructor(options: Options) {
    super();

    this.options = options;

    this.util = new BuilderUtil(options);

    this.userConfig = new UserConfig({
      cwd: options.cwd,
      transformers: options.transformers,
      packagers: options.packagers,
      optimization: options.optimization,
    });

    this.farm = new Farm(this.userConfig);
    this.worker = this.farm.interface();

    this.time = new Time();

    this.summary = new Map();
    this.builderGraph = new BuilderGraph(this);
    this.hooks = createBuilderHooks();
    this.public = new PublicBuilder(this.hooks);

    this.currentBuild = null;
    this.firstBuild = true;

    this.watcher = options.watch ? new Watcher() : null;
    this.rebuildTimeout = null;
    this.filesAdded = new Set();
    this.filesChanged = new Set();
    this.filesRemoved = new Set();

    this.hmrServer = options.hmr ? new HMRServer(this) : null;
  }

  async loadPlugins() {
    const { cwd, plugins: wantedPlugins } = this.options;

    for (let i = 0; i < wantedPlugins.length; i++) {
      const wanted = wantedPlugins[i];
      if (!wanted) {
        continue;
      }

      const { name, plugin, options } = getOnePlugin(wanted, cwd);

      if (typeof plugin === "function") {
        try {
          await plugin({ ...options }, this.public);
        } catch (error) {
          const which = name || plugin.name || `at position ${i}`;

          throwDiagnostic({
            category: "error",
            message: `Plugin ${which} thrown an error at initialization`,
            related: [createDiagnosticFromAny(error)],
          });
        }
      } else {
        const which = name || `at position ${i}`;

        throwDiagnostic({
          category: "error",
          message: `Expected plugin ${which} to be a function instead got ${typeOf(
            plugin
          )}`,
        });
      }
    }

    install(this.public);
  }

  fileAdded(path: string) {
    this.filesAdded.add(path);
    this.queueBuild();
  }

  fileChanged(path: string) {
    this.filesChanged.add(path);
    this.queueBuild();
  }

  fileRemoved(path: string) {
    this.filesRemoved.add(path);
    this.queueBuild();
  }

  async start() {
    this.emit("status", "Setting up...");
    const result = await this.setup();
    this.emit("build-setup", result);

    const firstJob = (this.currentBuild = this.rebuild(this.currentBuild));

    return {
      result,
      firstJob,
    };
  }

  async stop() {
    this.emit("status", "Exiting...");
    const result = await this.teardown();
    this.emit("build-teardown", result);
    return result;
  }

  private async setup(): Promise<BuilderSetupResult> {
    const loadingPlugins = catchErr(this.loadPlugins());

    const farmInit = catchErr(this.farm.setup());

    const hmrServerInit = catchErr(
      this.hmrServer ? this.hmrServer.start() : noopPromise
    );

    const watcherInit = catchErr(
      this.watcher
        ? this.watcher.start(this.options.watchOptions, this)
        : noopPromise
    );

    const pluginsSetup = catchErr(this.hooks.setup.call());

    const jobs = await Promise.all([
      loadingPlugins,
      farmInit,
      hmrServerInit,
      watcherInit,
      pluginsSetup,
    ]);

    const errors = jobs.filter((v): v is Diagnostic => v != null);

    this.time.checkpoint("setup");

    if (errors.length) {
      return {
        state: "error",
        errors,
        warnings: this.public.getAndClearWarnings(),
      };
    }

    return {
      state: "success",
      warnings: this.public.getAndClearWarnings(),
    };
  }

  private async teardown(): Promise<BuilderTeardownResult> {
    this.builderGraph.interrupt();
    if (this.rebuildTimeout) clearTimeout(this.rebuildTimeout);

    const farmStop = catchErr(this.farm.stop());

    const { watcher } = this;
    const watcherStop = catchErr(watcher ? watcher.stop() : noopPromise);

    const { hmrServer } = this;
    const hmrServerStop = catchErr(hmrServer ? hmrServer.stop() : noopPromise);

    await this.currentBuild;

    const pluginsTeardown = catchErr(this.hooks.teardown.call());

    const jobs = await Promise.all([
      farmStop,
      watcherStop,
      hmrServerStop,
      pluginsTeardown,
    ]);

    const errors = jobs.filter((v): v is Diagnostic => v != null);

    if (errors.length) {
      return {
        state: "error",
        errors,
        warnings: this.public.getAndClearWarnings(),
      };
    }

    return {
      state: "success",
      warnings: this.public.getAndClearWarnings(),
    };
  }

  private queueBuild() {
    if (this.rebuildTimeout) clearTimeout(this.rebuildTimeout);
    this.rebuildTimeout = setTimeout(() => {
      this.currentBuild = this.rebuild(this.currentBuild);
    }, 1000);
  }

  private async rebuild(
    prevBuildJob: Promise<BuilderResult> | null
  ): Promise<BuilderResult> {
    this.emit("files-updated", {
      added: Array.from(this.filesAdded).sort(),
      changed: Array.from(this.filesChanged).sort(),
      removed: Array.from(this.filesRemoved).sort(),
    });

    // Two pre-conditions for calling "this.build"
    this.builderGraph.interrupt();
    await prevBuildJob;

    for (const f of this.filesAdded) this.builderGraph.fileAdded(f);
    for (const f of this.filesChanged) this.builderGraph.fileChanged(f);
    for (const f of this.filesRemoved) this.builderGraph.fileRemoved(f);
    this.filesAdded.clear();
    this.filesChanged.clear();
    this.filesRemoved.clear();

    this.emit("status", "Building...");

    // Start new build
    const result = await this.build();

    this.emit("build-result", result);

    if (result.state === "success") {
      if (this.watcher) {
        // Update tracked files
        const files = this.builderGraph.watchedFiles();
        this.watcher.trackFiles(files);
        this.emit("watching", Array.from(files));
      }
    }

    return result;
  }

  private async build(): Promise<BuilderResult> {
    const gen = this.buildSteps();
    let step = gen.next();

    while (!step.done) {
      try {
        const ret = await step.value;
        if (Array.isArray(ret) && ret.length) {
          return {
            state: "error",
            errors: ret,
            warnings: this.public.getAndClearWarnings(),
          };
        }
      } catch (err) {
        return {
          state: "error",
          errors: [createDiagnosticFromAny(err)],
          warnings: this.public.getAndClearWarnings(),
        };
      }

      if (this.builderGraph.wasInterrupted()) {
        return {
          state: "interrupted",
        };
      }

      step = gen.next();
    }

    return {
      state: "success",
      output: step.value,
      warnings: this.public.getAndClearWarnings(),
    };
  }

  private *buildSteps() {
    if (this.firstBuild) {
      this.firstBuild = false;
    } else {
      this.time.start();
    }

    yield this.hooks.startedCompilation.call();

    yield this.hooks.startedAssetProcessing.call();

    yield this.builderGraph.run(this.options.entries);

    this.time.checkpoint("modules processing");

    yield this.hooks.endedAssetProcessing.call();

    yield this.hooks.endedCompilation.call();

    return {} as Output;

    // this.emit( "status", "Checking..." );
    // await this.wait( Promise.all( this.actualCheckers.map( c => c.check() ) ) );
    // this.time.checkpoint( "checking" );

    /*

    this.emit( "status", "Computing graph..." );

    const processedGraph = processGraph( graph );

    this.time.checkpoint( "graph processing" );
    this.emit( "status", "Creating files..." );

    const { dotGraph } = this.options;
    if ( dotGraph ) {
      await this.wait( graph.dumpDotGraph( path.resolve( this.options.dest, dotGraph ) ) );
    }

    const { filesInfo, removedCount } = await this.wait( this.builderPack.run( processedGraph ) );

    this.time.checkpoint( "rendering" );

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

      this.time.checkpoint( "service worker creation" );
    }

    const updates: HmrUpdate[ "updates" ] = [];

    if ( this.options.hmr ) {
      const previousSummary = this.summary;
      const newSummary = new Map();

      for ( const [ m, file ] of processedGraph.moduleToFile ) {
        const { id } = m;
        const data = {
          id,
          file: file.relativeDest,
          fileIsEntry: file.isEntry,
          transformedId: m.transformedId,
          requires: new Set(
            m.requires.map( ( { id } ) => get( processedGraph.hashIds, id ) )
          )
        };

        newSummary.set( id, data );

        const inPrevSummary = previousSummary.get( id );
        if ( !inPrevSummary ) {
          updates.push( {
            id,
            file: data.file,
            prevFile: null,
            reloadApp: data.fileIsEntry
          } );
        } else if (
          inPrevSummary.transformedId !== data.transformedId ||
          !setEquals( inPrevSummary.requires, data.requires )
        ) {
          updates.push( {
            id,
            file: data.file,
            prevFile: inPrevSummary.file,
            reloadApp: inPrevSummary.fileIsEntry || data.fileIsEntry
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

      this.summary = newSummary;
    }

    return {
      filesInfo,
      removedCount,
      time: this.time.end(),
      timeCheckpoints: this.options._debug ? this.time.getCheckpoints() : undefined,
      hmrUpdate: {
        updates,
        moduleToAssets: processedGraph.moduleToAssets
      }
    };

    */
  }
}
