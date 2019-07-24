import { ToWrite, TransformableAsset, FinalAsset, WatchedFileInfo } from "../types";
import { BuilderUtil, ModuleContext } from "./context";
import { UserConfig } from "../builder/user-config";
import { PluginsRunner } from "./runner";
import { deserialize, serialize } from "../utils/serialization";

function reviveBuilderUtil( value: any ): BuilderUtil {
  return Object.assign( Object.create( BuilderUtil.prototype ), value );
}

function reviveModuleContext( value: any ): ModuleContext {
  return Object.assign( Object.create( ModuleContext.prototype ), value );
}

export const workerMethods: ( keyof IPluginsRunnerInWorker )[] = [ "pipeline", "renderAsset" ];

export interface IPluginsRunnerInWorker {
  pipeline( asset: SharedArrayBuffer | null, ctx: ModuleContext ): Promise<{
    result: TransformableAsset;
    files: Map<string, WatchedFileInfo>;
  }>;
  renderAsset( asset: FinalAsset, hashIds: ReadonlyMap<string, string>, util: BuilderUtil ): Promise<{
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

  async pipeline( buffer: SharedArrayBuffer | null, _ctx: ModuleContext ) {
    const asset = buffer ? deserialize<TransformableAsset>( buffer ) : null;
    const ctx = reviveModuleContext( _ctx );
    const result = await this.runner.pipeline( asset, ctx );
    return {
      result: result, // TODO serialize( result ),
      files: ctx.files
    };
  }

  async renderAsset( asset: FinalAsset, hashIds: ReadonlyMap<string, string>, _util: BuilderUtil ) {
    const util = reviveBuilderUtil( _util );
    const result = await this.runner.renderAsset( asset, hashIds, util );
    return {
      result,
      files: util.files
    };
  }

}
