import { MaybeAsyncOptional, Optional } from "../../types";
import {
  createDiagnostic,
  createDiagnosticFromAny,
  Diagnostic,
} from "../../utils/error";
import { ResolveHook } from "./resolve";
import { TransformHook } from "./transform";
import {
  AssetDoneHook,
  AssetDeletedHook,
  StartedCompilation,
  EndedCompilation,
  StartedAssetProcessing,
  EndedAssetProcessing,
  Setup,
  Teardown,
} from "./events";

type HookPluginCb<Arg, CbRet> = (args: Arg) => CbRet;

type HookPlugin<Arg, CbRet> = Readonly<{
  name: string;
  cb: HookPluginCb<Arg, CbRet>;
}>;

export abstract class Hook<Arg, CbRet, Normalized> {
  public readonly name: string;
  protected readonly plugins: HookPlugin<Arg, CbRet>[];

  constructor(name: string) {
    this.name = name;
    this.plugins = [];
  }

  pluginCount() {
    return this.plugins.length;
  }

  tap(name: string, cb: HookPluginCb<Arg, CbRet>) {
    this.plugins.push({ name, cb });
  }

  handleError(pluginName: string, _arg: Arg, error: unknown): Diagnostic {
    return createDiagnostic({
      category: "error",
      message: `Plugin ${pluginName} on ${this.name} hook thrown an error`,
      related: [createDiagnosticFromAny(error)],
    });
  }

  protected abstract run(
    pluginName: string,
    cb: HookPluginCb<Arg, CbRet>,
    arg: Arg
  ): CbRet;

  abstract call(arg: Arg): Normalized;
}

export abstract class SyncHook<Arg, Ret, Normalized = Ret> extends Hook<
  Arg,
  Optional<Ret>,
  Normalized
> {
  protected run(
    pluginName: string,
    cb: HookPluginCb<Arg, Optional<Ret>>,
    arg: Arg
  ) {
    try {
      return cb(arg);
    } catch (error) {
      throw this.handleError(pluginName, arg, error);
    }
  }
}

export abstract class AsyncHook<Arg, Ret, Normalized = Ret> extends Hook<
  Arg,
  MaybeAsyncOptional<Ret>,
  Promise<Normalized>
> {
  protected async run(
    pluginName: string,
    cb: HookPluginCb<Arg, MaybeAsyncOptional<Ret>>,
    arg: Arg
  ) {
    try {
      return await cb(arg);
    } catch (error) {
      throw this.handleError(pluginName, arg, error);
    }
  }
}

export abstract class SyncSeriesHook<Arg> extends SyncHook<Arg, void> {
  call(arg: Arg) {
    for (const { name, cb } of this.plugins) {
      this.run(name, cb, arg);
    }
  }
}

export abstract class AsyncSeriesHook<Arg> extends AsyncHook<Arg, void> {
  async call(arg: Arg) {
    for (const { name, cb } of this.plugins) {
      await this.run(name, cb, arg);
    }
  }
}

export abstract class AsyncSeriesBailHook<
  Arg,
  Ret,
  Normalized = Ret
> extends AsyncHook<Arg, Ret, Normalized> {
  abstract validate(
    pluginName: string | undefined,
    arg: Arg,
    value: unknown
  ): Normalized;

  async call(arg: Arg) {
    for (const { name, cb } of this.plugins) {
      const ret = await this.run(name, cb, arg);
      if (ret != null) {
        return this.validate(name, arg, ret);
      }
    }
    return this.validate(undefined, arg, undefined);
  }
}

export abstract class AsyncSeriesWaterfallHook<Arg> extends AsyncHook<
  Arg,
  Arg
> {
  abstract validate(pluginName: string | undefined, value: unknown): Arg;

  async call(_arg: Arg) {
    let arg = _arg;
    for (const { name, cb } of this.plugins) {
      const ret = await this.run(name, cb, arg);
      if (ret != null) {
        arg = this.validate(name, ret);
      }
    }
    return this.validate(undefined, arg);
  }
}

export function createBuilderHooks() {
  return {
    setup: new Setup("setup"),
    teardown: new Teardown("teardown"),
    startedCompilation: new StartedCompilation("startedCompilation"),
    endedCompilation: new EndedCompilation("endedCompilation"),
    startedAssetProcessing: new StartedAssetProcessing(
      "startedAssetProcessing"
    ),
    endedAssetProcessing: new EndedAssetProcessing("endedAssetProcessing"),
    resolve: new ResolveHook("resolve"),
    transform: new TransformHook("transform"),
    assetDone: new AssetDoneHook("assetDone"),
    assetDeleted: new AssetDeletedHook("assetDeleted"),
  };
}

export type BuilderHooks = ReturnType<typeof createBuilderHooks>;
