import { Transforms, TransformableAsset, FinalAsset } from "../types";
import { BuilderUtil, ModuleContext } from "./context";
import { Farm } from "../workers/farm";
import { UserConfig } from "../builder/user-config";
import { PluginsRunner } from "./runner";
import { IPluginsRunnerInWorker } from "./worker-runner";

export class PluginsRunnerLocal {

  private runner: PluginsRunner;
  private farm: Farm;
  private worker: IPluginsRunnerInWorker;

  constructor( options: UserConfig ) {
    this.runner = new PluginsRunner( options );
    this.farm = new Farm( options );
    this.worker = this.farm.setup();
  }

  async init() {
    const { resolvers, cwd } = this.runner.config;
    await this.runner.resolvers.init( resolvers, cwd );
    await this.farm.workersReady();
  }

  stopFarm() {
    return this.farm.stop();
  }

  resolve( imported: string, module: ModuleContext ): Promise<{ path: string; transforms?: Transforms } | false> {
    return this.runner.resolve( imported, module );
  }

  pipeline( asset: TransformableAsset | null, ctx: ModuleContext ) {
    return this.worker.pipeline( asset, ctx );
  }

  renderAsset( asset: FinalAsset, util: BuilderUtil ) {
    return this.worker.renderAsset( asset, util );
  }

}
