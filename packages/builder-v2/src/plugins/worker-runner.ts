import {
  ToWrite,
  FinalAsset,
  WatchedFileInfo,
  ImmutableAssets,
} from "../types";
import { BuilderUtil, TransformContext } from "./context";
import { UserConfig } from "../builder/user-config";
import { PluginsRunner } from "./runner";

function reviveBuilderUtil(value: any): BuilderUtil {
  return Object.assign(Object.create(BuilderUtil.prototype), value);
}

function reviveTransformContext(value: any): TransformContext {
  return Object.assign(Object.create(TransformContext.prototype), value);
}

export const workerMethods: (keyof IPluginsRunnerInWorker)[] = [
  "transform",
  "renderAsset",
];

export interface IPluginsRunnerInWorker {
  transform(
    ctx: TransformContext
  ): Promise<{
    assets: ImmutableAssets;
    files: ReadonlyMap<string, WatchedFileInfo>;
  }>;
  renderAsset(
    asset: FinalAsset,
    hashIds: ReadonlyMap<string, string>,
    util: BuilderUtil
  ): Promise<{
    result: ToWrite;
    files: ReadonlyMap<string, WatchedFileInfo>;
  }>;
}

export class PluginsRunnerInWorker implements IPluginsRunnerInWorker {
  private runner: PluginsRunner;

  constructor(options: UserConfig) {
    this.runner = new PluginsRunner(options);
  }

  async init() {
    const { transformers, packagers, cwd } = this.runner.config;
    await this.runner.transformers.init(transformers, cwd);
    await this.runner.packagers.init(packagers, cwd);
  }

  async transform(_ctx: TransformContext) {
    const ctx = reviveTransformContext(_ctx);
    const assets = await this.runner.transform(ctx);
    return {
      assets,
      files: ctx.getFiles(),
    };
  }

  async renderAsset(
    asset: FinalAsset,
    hashIds: ReadonlyMap<string, string>,
    _util: BuilderUtil
  ) {
    const util = reviveBuilderUtil(_util);
    const result = await this.runner.renderAsset(asset, hashIds, util);
    return {
      result,
      files: util.getFiles(),
    };
  }
}
