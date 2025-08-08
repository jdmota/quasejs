import { Transforms, FinalAsset } from "../types";
import { BuilderUtil, ModuleContext } from "./context";
import { Farm } from "../workers/farm";
import { UserConfig } from "../builder/user-config";
import { PluginsRunner } from "./runner";
import { IPluginsRunnerInWorker } from "./worker-runner";
import { serialize } from "../utils/serialization";

export class PluginsRunnerLocal {
  private runner: PluginsRunner;
  private farm: Farm;
  private worker: IPluginsRunnerInWorker;

  constructor(options: UserConfig) {
    this.runner = new PluginsRunner(options);
    this.farm = new Farm(options);
    this.worker = this.farm.setup();
  }

  async init() {
    const { resolvers, cwd } = this.runner.config;
    await this.runner.resolvers.init(resolvers, cwd);
    await this.farm.workersReady();
  }

  stopFarm() {
    return this.farm.stop();
  }

  resolve(
    imported: string,
    module: ModuleContext
  ): Promise<{ path: string; transforms?: Transforms } | false> {
    return this.runner.resolve(imported, module);
  }

  async pipeline(asset: SharedArrayBuffer | null, ctx: ModuleContext) {
    const { result, files } = await this.worker.pipeline(asset, ctx);
    return {
      result: serialize(result), // TODO remove
      files,
    };
  }

  renderAsset(
    asset: FinalAsset,
    hashIds: ReadonlyMap<string, string>,
    util: BuilderUtil
  ) {
    return this.worker.renderAsset(asset, hashIds, util);
  }
}
