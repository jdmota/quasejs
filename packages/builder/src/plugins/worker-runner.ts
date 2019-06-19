import { ToWrite, TransformableAsset, FinalAsset, WatchedFileInfo } from "../types";
import { BuilderUtil, ModuleContext } from "./context";
import { UserConfig } from "../builder/user-config";
import { PluginsRunner } from "./runner";

function reviveBuilderUtil( value: any ): BuilderUtil {
  return Object.assign( Object.create( BuilderUtil.prototype ), value );
}

function reviveModuleContext( value: any ): ModuleContext {
  return Object.assign( Object.create( ModuleContext.prototype ), value );
}

export const workerMethods: ( keyof IPluginsRunnerInWorker )[] = [ "pipeline", "renderAsset" ];

export interface IPluginsRunnerInWorker {
  pipeline( asset: TransformableAsset | null, ctx: ModuleContext ): Promise<{
    result: TransformableAsset;
    files: Map<string, WatchedFileInfo>;
  }>;
  renderAsset( asset: FinalAsset, util: BuilderUtil ): Promise<{
    result: ToWrite;
    files: Map<string, WatchedFileInfo>;
  }>;
}

export class PluginsRunnerInWorker implements IPluginsRunnerInWorker {

  private runner: PluginsRunner;

  constructor( options: UserConfig ) {
    this.runner = new PluginsRunner( options );
  }

  async init() {
    const { transformers, packagers, cwd } = this.runner.config;
    await this.runner.transformers.init( transformers, cwd );
    await this.runner.packagers.init( packagers, cwd );
  }

  async pipeline( asset: TransformableAsset | null, _ctx: ModuleContext ) {
    const ctx = reviveModuleContext( _ctx );
    const result = await this.runner.pipeline( asset, ctx );
    return {
      result,
      files: ctx.files
    };
  }

  async renderAsset( asset: FinalAsset, _util: BuilderUtil ) {
    const util = reviveBuilderUtil( _util );
    const result = await this.runner.renderAsset( asset, util );
    return {
      result,
      files: util.files
    };
  }

}
