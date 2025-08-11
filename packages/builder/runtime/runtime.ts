/// <reference lib="dom" />
/// <reference lib="webworker" />
import type { AssetType, RuntimeManifest } from "../graph/graph";
import type { readFile } from "fs/promises";

export type HmrUpdate = Readonly<{
  fileChanges: readonly string[];
  moduleChanges: readonly string[];
  moduleToAssets: Readonly<{ [id: string]: readonly string[] }>;
}>;

export type HmrUpdateMsg = {
  type: "update";
  update: HmrUpdate;
};

export type HmrErrorMsg = {
  type: "errors";
  errors: string[];
};

export type HmrMessage = HmrUpdateMsg | HmrErrorMsg;

type HmrOpts = {
  hostname: string;
  port: number;
};

type MaybeAsync<T> = Promise<T> | T;
type Registerer<Fn> = (fn: Fn) => void;

type HotApiState =
  | "prepared"
  | "activating"
  | "active"
  | "disposing"
  | "disposed";

type HotApiLifecycle = {
  beforeDepDispose: () => MaybeAsync<{ reload: boolean }>;
  dispose: () => MaybeAsync<{ fullReload: boolean }>;
  activate: () => MaybeAsync<void>;
  afterDepActivate: (error: unknown) => MaybeAsync<void>;
};

type PublicDepHotApi = Readonly<{
  state: HotApiState | undefined;
  beforeDispose: Registerer<HotApiLifecycle["beforeDepDispose"]>;
  afterActivate: Registerer<HotApiLifecycle["afterDepActivate"]>;
}>;

type PublicHotApi = Readonly<{
  state: HotApiState;
  data: O<unknown>;
  dispose: Registerer<HotApiLifecycle["dispose"]>;
  activate: Registerer<HotApiLifecycle["activate"]>;
  dep: (id: string) => PublicDepHotApi;
}>;

declare const $_PUBLIC_PATH: string;
declare const $_HMR: HmrOpts | null;
declare const $_WITH_BROWSER: boolean;
declare const $_BUILD_KEY: unique symbol;
declare const $_MY_ID: string;

/* globals self */
/* eslint no-console: 0, @typescript-eslint/camelcase: 0 */

type O<T> = { [key: string]: T | undefined };

type Exported = {
  __esModule: boolean;
  default?: unknown;
  [key: string]: unknown;
};

type QuaseBuilderLoaded = Readonly<{
  r: {
    (id: string): Exported;
    r(id: string): unknown;
  };
  i: (id: string) => Promise<Exported>;
  q: {
    push: (arg: [O<ModuleFn>, RuntimeManifest | undefined]) => void;
  };
}>;

type QuaseBuilderPartial = Readonly<{
  q: [O<ModuleFn>, RuntimeManifest | undefined][];
}>;

type QuaseBuilder = QuaseBuilderLoaded | QuaseBuilderPartial;

type ModuleFn = (_: {
  e: Exported;
  r: QuaseBuilderLoaded["r"];
  i: QuaseBuilderLoaded["i"];
  g: (e: Exported, name: string, get: () => any) => void;
  a: (e: Exported, o: O<any>) => void;
  m: O<unknown>;
}) => void;

type GlobalThis = {
  window?: Window;
  document?: Document;
  location?: Location /*| WorkerLocation*/;
  WebSocket?: {
    new (url: string): WebSocket;
  };
  importScripts?: (...urls: (string | URL)[]) => void;
  [$_BUILD_KEY]?: QuaseBuilder;
};

(function (
  global: GlobalThis,
  nodeRequire: false | NodeJS.Require,
  buildKey: typeof $_BUILD_KEY,
  myId: string
) {
  // Help reduce minified size
  const UNDEFINED = undefined;
  const NULL = null;
  const { document, location, importScripts } = global;
  const browser =
    $_WITH_BROWSER && global.window === global ? document : UNDEFINED;

  const blank = <T>() => Object.create(NULL) as O<T>;

  const modules = blank<Exported>();
  const oldModules =
    blank<Readonly<{ exported: Exported | undefined; data: O<unknown> }>>(); // Just for HMR
  const fnModules = blank<ModuleFn | null>(); // Functions that load the module
  const fileImports = blank<null>(); // Files that were imported already
  const fetches = blank<Promise<void>>(); // Fetches

  const publicPath = $_PUBLIC_PATH;
  const moduleToAssets = blank<readonly string[]>();

  const hmr = $_HMR;
  const hmrOps = hmr ? makeHmr(hmr) : NULL;

  function makeHmr(hmr: HmrOpts) {
    const { WebSocket } = global;
    const hmrApis = new Map<string, HotApi>();

    let waitUnlockImports: null | Promise<void> = null;
    let unlockImports: null | (() => void) = null;

    const getHotApi = (id: string) => {
      const api = hmrApis.get(id) || new HotApi(id, oldModules[id]?.data);
      hmrApis.set(id, api);
      return api;
    };

    const hmrRequireSync = (parentApi: HotApi): QuaseBuilderLoaded["r"] => {
      const newFn = (id: string) => {
        if (waitUnlockImports) {
          throw new Error("Sync imports are not possible during an HMR update");
        }
        parentApi.imports(getHotApi(id));
        return requireSync(id);
      };

      newFn.r = (id: string) => {
        const e = newFn(id);
        return e.__esModule === false ? e.default : e;
      };
      return newFn;
    };

    const hmrRequireAsync = (parentApi: HotApi): QuaseBuilderLoaded["i"] => {
      return async (id: string) => {
        while (waitUnlockImports) {
          await waitUnlockImports;
          // Ensure with a "while" if imports were not blocked again here
        }
        parentApi.imports(getHotApi(id));
        return requireAsync(id);
      };
    };

    class HotApi {
      public readonly id: string;
      private state: HotApiState;
      private readonly data: O<unknown>;
      private readonly requires: Set<HotApi>;
      private readonly requiredBy: Set<HotApi>;
      private readonly callbacks: {
        beforeDepDispose: O<HotApiLifecycle["beforeDepDispose"]>;
        dispose: HotApiLifecycle["dispose"] | null;
        activate: HotApiLifecycle["activate"] | null;
        afterDepActivate: O<HotApiLifecycle["afterDepActivate"]>;
      };

      constructor(id: string, data: O<unknown> | undefined) {
        this.id = id;
        this.state = "prepared";
        this.data = data ? { ...data } : blank();
        this.requires = new Set();
        this.requiredBy = new Set();
        this.callbacks = {
          beforeDepDispose: blank(),
          dispose: null,
          activate: null,
          afterDepActivate: blank(),
        };
      }

      public(): PublicHotApi {
        const self = this;
        return {
          get state() {
            return self.state;
          },
          data: self.data,
          dispose(fn) {
            self.callbacks.dispose = fn;
          },
          activate(fn) {
            self.callbacks.activate = fn;
          },
          dep(depId) {
            return {
              get state() {
                return hmrApis.get(depId)?.state;
              },
              beforeDispose(fn) {
                self.callbacks.beforeDepDispose[depId] = fn;
              },
              afterActivate(fn) {
                self.callbacks.afterDepActivate[depId] = fn;
              },
            };
          },
        };
      }

      imports(imported: HotApi) {
        this.requires.add(imported);
        imported.requiredBy.add(this);
      }

      private unimports(imported: HotApi) {
        this.requires.delete(imported);
        imported.requiredBy.delete(this);
      }

      private cleanup() {
        oldModules[this.id] = {
          exported: modules[this.id],
          data: this.data,
        };
        modules[this.id] = UNDEFINED;

        for (const imported of this.requires) {
          this.unimports(imported);
        }

        for (const parent of this.requiredBy) {
          parent.unimports(this);
        }

        hmrApis.delete(this.id);
      }

      private async callBeforeDepDispose(depId: string) {
        const fn = this.callbacks.beforeDepDispose[depId];
        if (fn) {
          try {
            const { reload } = await fn();
            return { reload, error: null };
          } catch (error) {
            if (error) {
              console.error(
                `Error in (${this.id}).dep("${depId}").beforeDispose callback:`,
                error
              );
            }
            return { reload: true, error };
          }
        } else {
          return { reload: true, error: null };
        }
      }

      private async callDispose() {
        const fn = this.callbacks.dispose;
        if (fn) {
          try {
            const { fullReload } = await fn();
            return { fullReload, error: null };
          } catch (error) {
            if (error) {
              console.error(`Error in (${this.id}).dispose callback:`, error);
            }
            return { fullReload: true, error };
          }
        } else {
          return { fullReload: true, error: null };
        }
      }

      private async _requireAsync() {
        try {
          await requireAsync(this.id);
          return { error: null };
        } catch (error) {
          console.error(`Error in import("${this.id}"):`, error);
          return { error };
        }
      }

      private requireAsyncJob: Promise<{
        error: unknown;
      }> | null = null;
      private requireAsync() {
        return (
          this.requireAsyncJob || (this.requireAsyncJob = this._requireAsync())
        );
      }

      private async _callActivate() {
        const fn = this.callbacks.activate;
        if (fn) {
          try {
            await fn();
            return { error: null };
          } catch (error) {
            console.error(`Error in (${this.id}).activate callback:`, error);
            return { error };
          }
        } else {
          return { error: null };
        }
      }

      private activateJob: Promise<{
        error: unknown;
      }> | null = null;
      private callActivate() {
        return this.activateJob || (this.activateJob = this._callActivate());
      }

      private async callAfterDepActivate(depId: string, error: unknown) {
        const fn = this.callbacks.afterDepActivate[depId];
        if (fn) {
          try {
            await fn(error);
            return { error: null };
          } catch (error) {
            console.error(
              `Error in (${this.id}).dep("${depId}").afterActivate callback:`,
              error
            );
            return { error };
          }
        } else {
          return { error: null };
        }
      }

      static async applyUpdates(hmrUpdate: HmrUpdate) {
        // Any async import during the update is left pending until this finishes.
        // Alternative solutions have several drawbacks:
        // 1. Import the older version if loaded, fetch and load the newer otherwise.
        //    What if a new module requires an already loaded module, getting the older version?
        //    Not only it might fail if a new requirement is needed, but it will be disposed anyway.
        // 2. Import the older version, delaying the manifest update to after the disposal phase.
        //    If a changed module is loaded for the first time during the disposal phase, an older version of it will be imported (because the import relied on the old manifest), which then would need to be disposed. This would require restarting the disposal phase if old modules were imported meanwhile.
        // To ensure correctness, avoid older modules importing newer modules (and vice-versa), and "required by" links being changed during the update, async imports are delayed.
        // Sync imports thrown an error. This should only occur if a "require" call is performed in async code. An async import is always preferable anyway. This should be a very rare edge case.

        // Block new imports
        waitUnlockImports = new Promise(resolve => {
          unlockImports = resolve;
        });

        // Wait for pending file fetches that already started to finish
        // because they may modify "fnModules"
        for (const file in fetches) {
          try {
            await fetches[file];
          } catch (error) {}
        }

        // Given that imports are delayed during an HMR update,
        // we can immediately update manifests and download needed files

        // Update manifests

        for (const id in moduleToAssets) {
          delete moduleToAssets[id];
        }

        for (const id in hmrUpdate.moduleToAssets) {
          moduleToAssets[id] = hmrUpdate.moduleToAssets[id];
        }

        for (const file of hmrUpdate.fileChanges) {
          delete fileImports[publicPath + file];
          delete fetches[publicPath + file];
        }

        const toDispose = new Set<HotApi>();
        const refetchDeps = new Map<HotApi | null, Set<string>>();

        const shouldReloadApp = {
          moduleChanges: new Set(hmrUpdate.moduleChanges),
          requestedFullReload: new Set<string>(),
        } as const;

        // Modules that were changed will need their old code invalidated
        // and later to be disposed and reloaded
        // Modules that were removed or became orphan only need to be disposed
        // (these are included in the "moduleChanges" array)
        for (const id of hmrUpdate.moduleChanges) {
          const api = hmrApis.get(id);
          if (api) {
            toDispose.add(api);
          }
          // Make sure we clean up the code even if the module was not loaded before
          fnModules[id] = UNDEFINED;
        }

        // Download needed files (if any) in the meanwhile
        for (const id of hmrUpdate.moduleChanges) {
          for (const asset of moduleToAssets[id] || []) {
            importFileAsync(asset);
          }
        }

        // Although further imports are disabled during the update,
        // Modules might still have async code interacting with older (loaded) modules.
        // The before/after callbacks notify dependents that a module is being replaced.

        // Compute which other modules need to be disposed
        for (const api of toDispose) {
          for (const ancestor of api.requiredBy) {
            if (!toDispose.has(ancestor)) {
              const { reload } = await ancestor.callBeforeDepDispose(api.id);
              if (reload) {
                toDispose.add(ancestor);
                refetchDeps.delete(ancestor);
              } else {
                const set = refetchDeps.get(ancestor) || new Set();
                set.add(api.id);
                refetchDeps.set(ancestor, set);
              }
            }
          }
          // Allow entry to be reloaded without reloading the whole app
          // (if the entry has a dispose routine)
          if (api.id === myId) {
            refetchDeps.set(null, new Set([api.id]));
          }
        }

        // Dispose modules
        for (const api of toDispose) {
          const { fullReload } = await api.callDispose();
          if (fullReload) {
            shouldReloadApp.requestedFullReload.add(api.id);
          }
          api.cleanup();
        }

        // TODO global beforeUpdate/afterUpdate callbacks?

        if (shouldReloadApp.requestedFullReload.size > 0) {
          // Keep imports blocked if a reload is requested
          return shouldReloadApp;
        }

        // Reload neeeded modules and execute activate handlers
        for (const [api, deps] of refetchDeps) {
          for (const dep of deps) {
            const depApi = getHotApi(dep);
            if (api) api.imports(depApi);

            const error =
              (await depApi.requireAsync()).error ||
              (await depApi.callActivate()).error;
            if (api) await api.callAfterDepActivate(dep, error);
          }
        }

        // Unlock imports
        unlockImports!();
        unlockImports = waitUnlockImports = null;
        return null;
      }
    }

    let reloadApp: () => void;
    const state = {
      updating: false,
      success: true,
      reload: false,
    };

    const UI_ID = "__quase_builder_ui__";
    let ui: HTMLDivElement | null = null;

    const updateUI = () => {
      if (!browser) {
        return;
      }
      if (!ui) {
        ui = browser.createElement("div");
        ui.id = UI_ID;
        browser.body.appendChild(ui);
      }

      const { updating, success, reload } = state;

      ui.innerHTML = `
        <div style="
          z-index:99999;color:white;position:fixed;top:0;
          right:45px;line-height:30px;color:black;
          font-size:18px;font-family:Menlo, Consolas, monospace;
        ">
          <div style="
            ${reload ? "display:block;" : "display:none;"}
            padding:10px;background:yellow;float:left;cursor:pointer;
          ">🗘</div>
          <div style="
            ${updating ? "display:block;" : "display:none;"}
            padding:10px;background:yellow;float:left;
          ">Replacing modules...</div>
          <div style="
            float:left;
            background:${success ? "green" : "red"};
            padding:10px;
          ">Build: ${success ? "Success" : "Error"}</div>
        </div>`;

      ui.getElementsByTagName("div")[1].onclick = reloadApp;
    };

    let lastHotUpdate = Promise.resolve();

    const hmrMessageProcess = async (message: HmrMessage) => {
      lastHotUpdate = lastHotUpdate.then(async () => {
        if (state.reload) {
          console.warn(
            "[quase-builder] Ignoring update because a reload is necessary",
            message
          );
        } else if (message.type === "update") {
          console.log("[quase-builder] ✨", message.update);
          state.success = true;
          state.updating = true;
          updateUI();
          removeErrorOverlay();
          const reload = await HotApi.applyUpdates(message.update);
          if (reload) {
            console.warn("[quase-builder] Reload was requested:", reload);
            state.reload = true;
          }
          state.updating = false;
          updateUI();
        } else {
          console.error("[quase-builder] 🚨", message.errors);
          state.success = false;
          updateUI();
          createErrorOverlay(message.errors);
        }
      });
    };

    const OVERLAY_ID = "__quase_builder_error_overlay__";
    let overlay: HTMLDivElement | null = null;

    const removeErrorOverlay = () => {
      if (overlay) {
        overlay.remove();
        overlay = null;
      }
    };

    // Adapted from https://github.com/parcel-bundler/parcel
    const createErrorOverlay = (errors: string[]) => {
      if (!browser) {
        return;
      }
      if (!overlay) {
        overlay = browser.createElement("div");
        overlay.id = OVERLAY_ID;
        browser.body.appendChild(overlay);
      }

      // Html encode
      const errorText = browser.createElement("pre");
      errorText.innerText = errors.join("\n");

      overlay.innerHTML = `
        <div style="
          background:black;font-size:16px;color:white;
          position:fixed;height:100%;width:100%;top:0px;left:0px;
          padding:30px;opacity:0.85;font-family:Menlo,Consolas,monospace;z-index:9999;
        ">
          <span style="background:red;padding:2px 4px;border-radius:2px;">ERROR</span>
          <span style="margin-left:10px;font-size:18px;position:relative;cursor:pointer;">🗙</span>
          <pre style="margin-top:20px;">${errorText.innerHTML}</pre>
        </div>
      `;

      overlay.getElementsByTagName("span")[1].onclick = removeErrorOverlay;
    };

    const hmrInit = () => {
      if (!location || !WebSocket) {
        return;
      }
      const protocol = location.protocol === "https:" ? "wss" : "ws";
      const ws = new WebSocket(
        protocol + "://" + hmr.hostname + ":" + hmr.port + "/"
      );
      ws.onmessage = event => {
        hmrMessageProcess(JSON.parse(event.data) as HmrMessage);
      };
      ws.onerror = event => {
        console.error("[quase-builder] socket error", event);
      };
      ws.onopen = () => {
        console.log("[quase-builder] HMR connection open on port " + hmr.port);
      };

      reloadApp = () => {
        if (ws.readyState === 3) {
          location.reload();
        } else {
          ws.close();
          ws.onclose = () => {
            location.reload();
          };
        }
      };
    };

    return {
      init: hmrInit,
      getApi: getHotApi,
      requireSync: hmrRequireSync,
      requireAsync: hmrRequireAsync,
    };
  }

  function pushInfo({ f, m }: RuntimeManifest) {
    for (const id in m) {
      moduleToAssets[id] = m[id].map(i => f[i]);
    }
  }

  function pushModules(moreModules: O<ModuleFn>) {
    for (const id in moreModules) {
      if (fnModules[id] === UNDEFINED) {
        fnModules[id] = moreModules[id];
      }
    }
  }

  function push([fn, info]: [O<ModuleFn>, RuntimeManifest | undefined]) {
    if (info) pushInfo(info);
    pushModules(fn);
  }

  function exportHelper(e: Exported, name: string, get: () => unknown) {
    Object.defineProperty(e, name, {
      configurable: !!hmrOps,
      enumerable: true,
      get,
    });
  }

  function exportAllHelper(e: Exported, o: O<unknown>) {
    Object.keys(o).forEach(k => {
      if (k === "default" || k === "__esModule") return;
      Object.defineProperty(e, k, {
        configurable: true,
        enumerable: true,
        get: () => o[k],
      });
    });
  }

  const requireSync = (id: string): Exported => {
    // At this point, all the needed files should be already present
    const curr = modules[id];
    if (curr) {
      return curr;
    }

    const fn = fnModules[id];
    if (!hmr) {
      fnModules[id] = NULL;
    }

    if (fn) {
      let moduleExports: Exported;

      if (hmrOps) {
        function clear(exported: Exported) {
          for (const name in exported) {
            if (name === "__esModule") continue;
            delete exported[name];
          }
          return exported;
        }

        const api = hmrOps.getApi(id);

        moduleExports = clear(oldModules[id]?.exported || { __esModule: true });
        oldModules[id] = UNDEFINED;
        modules[id] = moduleExports;

        fn({
          e: moduleExports,
          r: hmrOps.requireSync(api),
          i: hmrOps.requireAsync(api),
          g: exportHelper,
          a: exportAllHelper,
          m: { hot: api.public() },
        });
      } else {
        moduleExports = { __esModule: true };
        modules[id] = moduleExports;

        fn({
          e: moduleExports,
          r: requireSync,
          i: requireAsync,
          g: exportHelper,
          a: exportAllHelper,
          m: {},
        });
      }

      return moduleExports;
    }

    const err = new Error(`Cannot find module ${id}`) as Error & {
      code: string;
    };
    err.code = "MODULE_NOT_FOUND";
    throw err;
  };

  requireSync.r = (id: string) => {
    const e = requireSync(id);
    return e.__esModule === false ? e.default : e;
  };

  async function requireAsync(id: string) {
    await Promise.all(
      modules[id] || fnModules[id]
        ? []
        : (moduleToAssets[id] || []).map(importFileAsync)
    );
    return requireSync(id);
  }

  // TODO support reloading css sync imported by entry html?
  // TODO if a file has a sync dep on css, then the css should be loaded before evaluating js right?
  // TODO make hmr work in nodejs and denojs

  function importFileAsync(src: string) {
    if (fileImports[src] !== UNDEFINED || fetches[src]) {
      return fetches[src];
    }

    let resolve: () => void = NULL as any;
    let reject: (err: Error) => void = NULL as any;

    const promise = new Promise<void>((a, b) => {
      resolve = () => {
        fetches[src] = UNDEFINED;
        fileImports[src] = NULL;
        a();
      };
      reject = (err: Error) => {
        fetches[src] = UNDEFINED;
        b(err);
      };
    });

    fetches[src] = promise;

    const fullSrc = publicPath + src;

    if (browser) {
      const elem = browser.createElement("script");
      elem.type = "text/javascript";
      elem.async = true;
      elem.src = hmrOps ? fullSrc + "?t=" + Date.now() : fullSrc;

      let timeout: any;

      const done = (err?: Error) => {
        clearTimeout(timeout);
        elem.onerror = elem.onload = NULL; // Avoid memory leaks in IE
        if (err) {
          elem.remove();
          reject(err);
        } else {
          resolve();
        }
      };

      const onError = () => {
        done(new Error(`Fetching ${fullSrc} failed`));
      };

      timeout = setTimeout(onError, 120000);

      elem.onload = () => {
        // This executes after the file is evaluated
        done();
      };
      elem.onerror = onError;

      browser.head.appendChild(elem);
    } else {
      Promise.resolve()
        .then(() => {
          if (importScripts) {
            importScripts(hmrOps ? fullSrc + "?t=" + Date.now() : fullSrc);
          } else if (nodeRequire) {
            const read: typeof readFile = nodeRequire("fs/promises").readFile;
            return read(fullSrc, "utf-8").then(code => new Function(code)());
          } else {
            // TODO in DENO we can use import?
            return import(fullSrc);
            throw new Error("Unknown env");
          }
        })
        .then(resolve, reject);
    }

    return promise;
  }

  let me = global[buildKey];

  function isPartial(me: QuaseBuilder): me is QuaseBuilderPartial {
    return Array.isArray(me.q);
  }

  if (me && isPartial(me)) {
    me.q.forEach(push);
    me = UNDEFINED;
  }

  if (!me) {
    me = global[buildKey] = {
      r: hmrOps ? hmrOps.requireSync(hmrOps.getApi($_MY_ID)) : requireSync,
      i: hmrOps ? hmrOps.requireAsync(hmrOps.getApi($_MY_ID)) : requireAsync,
      q: { push },
    };
    if (hmrOps) {
      hmrOps.init();
    }
  }

  return me.r;
})(
  // eslint-disable-next-line no-new-func
  typeof self !== "undefined" ? self : Function("return this")(),
  typeof require !== "undefined" && require,
  $_BUILD_KEY,
  $_MY_ID
);
