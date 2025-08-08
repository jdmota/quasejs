import type { MaybeAsync, Optional } from "./miscellaneous";
import {
  createDiagnostic,
  createDiagnosticFromAny,
  Diagnostic,
} from "../error/diagnostics";

// Inspired in webpack/tapable
// Inspired in koa-compose

type HookPluginCb<Args extends any[], CbRet> = (...args: Args) => CbRet;

type HookPlugin<Args extends any[], CbRet> = Readonly<{
  name: string;
  cb: HookPluginCb<Args, CbRet>;
}>;

export abstract class Hook<Args extends any[], CbRet, FinalRet> {
  public readonly name: string;
  protected readonly plugins: HookPlugin<Args, CbRet>[];

  constructor(name: string) {
    this.name = name;
    this.plugins = [];
  }

  pluginCount() {
    return this.plugins.length;
  }

  unshift(name: string, cb: HookPluginCb<Args, CbRet>) {
    this.plugins.unshift({ name, cb });
  }

  push(name: string, cb: HookPluginCb<Args, CbRet>) {
    this.plugins.push({ name, cb });
  }

  handleError(pluginName: string, error: unknown): Diagnostic {
    return createDiagnostic({
      category: "error",
      message: `Plugin ${pluginName} on ${this.name} hook thrown an error`,
      related: [createDiagnosticFromAny(error)],
    });
  }

  protected abstract run(
    pluginName: string,
    cb: HookPluginCb<Args, CbRet>,
    args: Args
  ): CbRet;

  abstract call(...args: Args): FinalRet;
}

export abstract class SyncHook<
  Args extends any[],
  CbRet,
  FinalRet = CbRet,
> extends Hook<Args, Optional<CbRet>, FinalRet> {
  protected run(
    pluginName: string,
    cb: HookPluginCb<Args, Optional<CbRet>>,
    args: Args
  ) {
    try {
      return cb(...args);
    } catch (error) {
      throw this.handleError(pluginName, error).attachStack(this.run);
    }
  }
}

export abstract class AsyncHook<
  Args extends any[],
  CbRet,
  FinalRet = CbRet,
> extends Hook<Args, MaybeAsync<Optional<CbRet>>, Promise<FinalRet>> {
  protected async run(
    pluginName: string,
    cb: HookPluginCb<Args, MaybeAsync<Optional<CbRet>>>,
    args: Args
  ) {
    try {
      return await cb(...args);
    } catch (error) {
      throw this.handleError(pluginName, error).attachStack(this.run);
    }
  }
}

export class SyncSeriesHook<Args extends any[]> extends SyncHook<Args, void> {
  call(...args: Args) {
    for (const { name, cb } of this.plugins) {
      this.run(name, cb, args);
    }
  }
}

export class AsyncSeriesHook<Args extends any[]> extends AsyncHook<Args, void> {
  async call(...args: Args) {
    for (const { name, cb } of this.plugins) {
      await this.run(name, cb, args);
    }
  }
}

export class SyncSeriesBailHook<Args extends any[], Ret> extends SyncHook<
  Args,
  Ret,
  Ret | null
> {
  call(...args: Args) {
    for (const { name, cb } of this.plugins) {
      const ret = this.run(name, cb, args);
      if (ret != null) {
        return ret;
      }
    }
    return null;
  }
}

export class AsyncSeriesBailHook<Args extends any[], Ret> extends AsyncHook<
  Args,
  Ret,
  Ret | null
> {
  async call(...args: Args) {
    for (const { name, cb } of this.plugins) {
      const ret = await this.run(name, cb, args);
      if (ret != null) {
        return ret;
      }
    }
    return null;
  }
}

export class SyncWaterfallHook<Arg> extends SyncHook<[Arg], Arg> {
  call(arg: Arg) {
    for (const { name, cb } of this.plugins) {
      const ret = this.run(name, cb, [arg]);
      if (ret != null) {
        arg = ret;
      }
    }
    return arg;
  }
}

export class AsyncWaterfallHook<Arg> extends AsyncHook<[Arg], Arg> {
  async call(arg: Arg) {
    for (const { name, cb } of this.plugins) {
      const ret = await this.run(name, cb, [arg]);
      if (ret != null) {
        arg = ret;
      }
    }
    return arg;
  }
}

// Adapted from koa-compose
export class AsyncMiddleware<Arg> extends AsyncHook<[Arg, () => void], void> {
  async call(arg: Arg, next: () => MaybeAsync<void>) {
    const funcs = this.plugins;
    const dispatch = async (i: number) => {
      const name = i === funcs.length ? "" : funcs[i].name;
      const fn = i === funcs.length ? next : funcs[i].cb;

      let nextCalled = false;
      let nextFinished = false;
      const nextProxy = async () => {
        if (nextCalled) throw new Error("next() called multiple times");
        nextCalled = true;
        try {
          return await dispatch(i + 1);
        } finally {
          nextFinished = true;
        }
      };
      await this.run(name, fn, [arg, nextProxy]);
      if (nextCalled && !nextFinished) {
        throw new Error(
          "Middleware finished before downstream. You are probably missing an await or return"
        );
      }
    };
    return dispatch(0);
  }
}

// TODO support async parallel
// TODO how to deal with errors? bail? support interceptors?
// TODO how to deal with multiple results?
