/// <reference lib="dom" />
/// <reference lib="webworker" />

export type RuntimeManifest = {
  f: string[];
  m: { [key: string]: number[] };
};

export type HmrUpdate = Readonly<{
  updates: Readonly<{
    id: string;
    file: string | null;
    prevFile: string | null;
    reloadApp: boolean;
  }>[];
  moduleToAssets: Readonly<{ [id: string]: string[] }>;
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

declare const $_PUBLIC_PATH: string;
declare const $_HMR: HmrOpts | null;
declare const $_WITH_BROWSER: boolean;
declare const $_BUILD_KEY: unique symbol;

/* globals self */
/* eslint no-console: 0, @typescript-eslint/camelcase: 0 */

type O<T> = { [key: string]: T | undefined };

type Exported = {
  __esModule: boolean;
  default?: unknown;
};

type HmrOpts = {
  hostname: string;
  port: number;
};

interface HotApiInterface {
  addRequiredBy(parentApi: HotApiInterface | null): void;
  onDependencyChange(id: string, fn: Function): void;
  onChange(fn: Function): void;
  callDependencyChange(id: string, error: Error | null): any;
  callChange(): any;
  notifyParents(
    seen: Set<HotApiInterface>,
    needReload: Set<HotApiInterface | null>,
    error: Error | null
  ): void;
  reset(fnReset: boolean): void;
  load(notifyAncestors: boolean): Promise<HmrLoad>;
  reload(): Promise<HmrLoad>;
  reloadNew(): Promise<HmrLoad>;
  delete(): void;
}

type HmrLoad = {
  api: HotApiInterface;
  error: Error | null;
  notifyAncestors: boolean;
};

type HmrOps = {
  init: () => void;
  getApi: (id: string) => HotApiInterface;
  requireSync: (parent: HotApiInterface | null) => {
    (id: string): Exported;
    r(id: string): unknown;
  };
  requireAsync: (
    parent: HotApiInterface | null
  ) => (id: string) => Promise<Exported>;
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
  nodeRequire: false | NodeRequire,
  buildKey: typeof $_BUILD_KEY
) {
  // Help reduce minified size
  const UNDEFINED = undefined;
  const NULL = null;
  const { document, location, importScripts } = global;
  const isBrowser = $_WITH_BROWSER && global.window === global;

  const blank = <T>() => Object.create(NULL) as O<T>;

  const modules = blank<Exported>();
  const fnModules = blank<ModuleFn | null>(); // Functions that load the module
  const fileImports = blank<null>(); // Files that were imported already
  const fetches = blank<Promise<void>>(); // Fetches

  const publicPath = $_PUBLIC_PATH;
  const moduleToAssets = blank<string[]>();

  const hmr = $_HMR;
  const hmrOps = hmr ? makeHmr(hmr) : NULL;

  function makeHmr(hmr: HmrOpts): HmrOps {
    const { WebSocket } = global;
    const hmrApis: Map<string, HotApi> = new Map();

    const getHotApi = (id: string) => {
      const api = hmrApis.get(id) || new HotApi(id);
      hmrApis.set(id, api);
      return api;
    };

    const hmrRequireSync = (
      parentApi: HotApiInterface | null
    ): QuaseBuilderLoaded["r"] => {
      const newFn = (id: string) => {
        const e = requireSync(id);
        getHotApi(id).addRequiredBy(parentApi);
        return e;
      };

      newFn.r = (id: string) => {
        const e = newFn(id);
        return e.__esModule === false ? e.default : e;
      };
      return newFn;
    };

    const hmrRequireAsync = (
      parentApi: HotApiInterface | null
    ): QuaseBuilderLoaded["i"] => {
      return async (id: string) => {
        const e = await requireAsync(id);
        getHotApi(id).addRequiredBy(parentApi);
        return e;
      };
    };

    class HotApi implements HotApiInterface {
      private id: string;
      private requiredBy: Set<HotApiInterface | null>;
      private dependencyChange: { [key: string]: Function };
      private change: Function | null;

      constructor(id: string) {
        this.id = id;
        this.requiredBy = new Set();
        this.dependencyChange = {};
        this.change = null;
      }

      addRequiredBy(parentApi: HotApiInterface | null) {
        this.requiredBy.add(parentApi);
      }

      onDependencyChange(id: string, fn: Function) {
        this.dependencyChange[id] = fn;
      }

      onChange(fn: Function) {
        this.change = fn;
      }

      callDependencyChange(id: string, error: Error | null) {
        const fn = this.dependencyChange[id];
        return fn ? fn(id, error) : false;
      }

      callChange() {
        const fn = this.change;
        return fn ? fn() : true;
      }

      notifyParents(
        seen: Set<HotApiInterface>,
        needReload: Set<HotApiInterface | null>,
        error: Error | null
      ) {
        const requiredBy = this.requiredBy;
        this.requiredBy = new Set();

        for (const ancestor of requiredBy) {
          if (ancestor) {
            if (!seen.has(ancestor)) {
              if (ancestor.callDependencyChange(this.id, error)) {
                needReload.add(ancestor);
              } else {
                this.requiredBy.add(ancestor);
              }
            }
          } else {
            needReload.add(null);
          }
        }
      }

      reset(fnReset: boolean) {
        this.dependencyChange = {};
        this.change = null;
        modules[this.id] = UNDEFINED;
        if (fnReset) {
          fnModules[this.id] = UNDEFINED;
        }
      }

      async load(notifyAncestors: boolean): Promise<HmrLoad> {
        try {
          await requireAsync(this.id);
          return {
            api: this,
            error: null,
            notifyAncestors,
          };
        } catch (error) {
          return {
            api: this,
            error: error as Error,
            notifyAncestors,
          };
        }
      }

      reload() {
        const notifyAncestors = this.callChange();
        this.reset(false);
        return this.load(notifyAncestors);
      }

      reloadNew() {
        const notifyAncestors = this.callChange();
        this.reset(true);
        return this.load(notifyAncestors);
      }

      delete() {
        // Module no longer exists.
        // Modules that depend on this will get reloaded later.
        this.callChange();

        this.reset(true);
        this.requiredBy.clear();
        hmrApis.delete(this.id);
      }
    }

    let reloadApp: any;
    let state = {
      success: true,
      reload: false,
    };

    const UI_ID = "__quase_builder_ui__";
    let ui: HTMLDivElement | null = null;

    const updateUI = () => {
      if (!document) {
        return;
      }
      if (!ui) {
        ui = document.createElement("div");
        ui.id = UI_ID;
        document.body.appendChild(ui);
      }

      const success = state.success;
      const reload = state.reload;

      ui.innerHTML = `<div style="z-index:99999;color:white;position:fixed;top:0;
          right: 50px;line-height:30px;font-family:Menlo, Consolas, monospace;">
          <div style="${
            reload ? "display:block;" : "display:none;"
          };font-size:18px;padding:10px;background:yellow;color:black;float:left;cursor:pointer;">🗘</div>
          <div style="float:left;background:${
            success ? "green" : "red"
          };padding:10px;">Build: ${success ? "Success" : "Error"}</div>
        </div>`;

      ui.getElementsByTagName("div")[1].onclick = reloadApp;
    };

    const hmrReloadApp = (reason: string) => {
      console.log("[quase-builder] App reload? Reason: " + reason);
      state.reload = true;
      updateUI();
    };

    let lastHotUpdate = Promise.resolve();

    const hmrUpdate = async (hmrUpdate: HmrUpdate) => {
      const seen: Set<HotApi> = new Set();
      let queue: Promise<HmrLoad>[] = [];
      let shouldReloadApp = false;
      let reloadCauseEntry = false;

      for (const id in moduleToAssets) {
        moduleToAssets[id] = undefined;
      }

      for (const id in hmrUpdate.moduleToAssets) {
        moduleToAssets[id] = hmrUpdate.moduleToAssets[id].map(
          f => publicPath + f
        );
      }

      for (const { file, prevFile, reloadApp } of hmrUpdate.updates) {
        if (file) {
          fileImports[publicPath + file] = UNDEFINED;
          fetches[publicPath + file] = UNDEFINED;
        }
        if (prevFile) {
          fileImports[publicPath + prevFile] = UNDEFINED;
          fetches[publicPath + prevFile] = UNDEFINED;
        }
        shouldReloadApp = shouldReloadApp || reloadApp;
      }

      reloadCauseEntry = shouldReloadApp;

      for (const { id, file } of hmrUpdate.updates) {
        const api = hmrApis.get(id);
        if (api) {
          seen.add(api);
          if (file) {
            queue.push(api.reloadNew());
          } else {
            api.delete();
          }
        }
      }

      while (queue.length > 0) {
        const prevQueue = queue;
        queue = [];

        const needReload: Set<HotApi> = new Set();

        for (const job of prevQueue) {
          const { api, error, notifyAncestors } = await job;

          if (notifyAncestors) {
            api.notifyParents(seen, needReload, error);
          }

          if (error) {
            console.error(error);
          }
        }

        for (const api of needReload) {
          if (api) {
            seen.add(api);
            queue.push(api.reload());
          } else {
            shouldReloadApp = true;
          }
        }
      }

      if (shouldReloadApp) {
        hmrReloadApp(
          reloadCauseEntry
            ? "Entry changed"
            : "Immediate entry dependency requested reload"
        );
      }
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
      if (!document) {
        return;
      }
      if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = OVERLAY_ID;
        document.body.appendChild(overlay);
      }

      // Html encode
      const errorText = document.createElement("pre");
      errorText.innerText = errors.join("\n");

      overlay.innerHTML = `<div style="background:black;font-size:16px;color:white;position:fixed;height:100%;width:100%;top:0px;left:0px;padding:30px;opacity:0.85; font-family:Menlo,Consolas,monospace;z-index: 9999;">
          <span style="background:red;padding:2px 4px;border-radius:2px;">ERROR</span>
          <span style="margin-left:10px;font-size:18px;position:relative;cursor:pointer;">🗙</span>
          <pre style="margin-top:20px;">${errorText.innerHTML}</pre>
        </div>`;

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
        const data = JSON.parse(event.data) as HmrMessage;

        switch (data.type) {
          case "update":
            lastHotUpdate = lastHotUpdate.then(() => {
              console.log("[quase-builder] ✨", data.update);
              state.success = true;
              updateUI();
              removeErrorOverlay();
              return hmrUpdate(data.update);
            });
            break;
          case "errors":
            console.error("[quase-builder] 🚨", data.errors);
            state.success = false;
            updateUI();
            createErrorOverlay(data.errors);
            break;
          default:
        }
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

  function require(id: string) {
    if (id) {
      if (importScripts) {
        importScripts(id);
      } else if (nodeRequire) {
        nodeRequire(id);
      }
    }
    return NULL;
  }

  function pushInfo(moreInfo: RuntimeManifest) {
    const files = moreInfo.f;
    const mToFiles = moreInfo.m;
    for (const id in mToFiles) {
      moduleToAssets[id] = mToFiles[id].map(f => publicPath + files[f]);
    }
  }

  function pushModules(moreModules: O<ModuleFn>) {
    for (const id in moreModules) {
      if (fnModules[id] === UNDEFINED) {
        fnModules[id] = moreModules[id];
      }
    }
  }

  function push(arg: [O<ModuleFn>, RuntimeManifest | undefined]) {
    if (arg[1]) pushInfo(arg[1]);
    pushModules(arg[0]);
  }

  function exportHelper(e: Exported, name: string, get: () => any) {
    Object.defineProperty(e, name, { enumerable: true, get });
  }

  function exportAllHelper(e: Exported, o: O<any>) {
    Object.keys(o).forEach(k => {
      if (k === "default" || k === "__esModule") return;
      Object.defineProperty(e, k, {
        configurable: true,
        enumerable: true,
        get: () => o[k],
      });
    });
  }

  function exists(id: string) {
    return !!(modules[id] || fnModules[id]);
  }

  const load = (id: string): Exported => {
    const curr = modules[id];
    if (curr) {
      return curr;
    }

    const fn = fnModules[id];
    if (!hmr) {
      fnModules[id] = NULL;
    }

    if (fn) {
      const moduleExports: Exported = { __esModule: true };

      modules[id] = moduleExports;

      if (hmrOps) {
        const api = hmrOps.getApi(id);

        fn({
          e: moduleExports,
          r: hmrOps.requireSync(api),
          i: hmrOps.requireAsync(api),
          g: exportHelper,
          a: exportAllHelper,
          m: { hot: api },
        });
      } else {
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

  function requireSync(id: string) {
    // At this point, all the needed files should be already present
    return load(id);
  }

  requireSync.r = (id: string) => {
    const e = requireSync(id);
    return e.__esModule === false ? e.default : e;
  };

  async function requireAsync(id: string) {
    await Promise.all(
      exists(id) ? [] : (moduleToAssets[id] || []).map(importFileAsync)
    );
    return load(id);
  }

  // TODO make hmr work in node
  // TODO make hmr work with css
  // TODO bypass cache with "?t=" + Date.now()

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

    if (isBrowser && document) {
      const script = document.createElement("script");
      script.type = "text/javascript";
      script.async = true;
      script.src = src;

      let timeout: any;

      const done = (err?: Error) => {
        clearTimeout(timeout);
        // @ts-ignore
        script.onerror = script.onload = NULL; // Avoid memory leaks in IE
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      };

      const onError = () => {
        done(new Error(`Fetching ${src} failed`));
      };

      timeout = setTimeout(onError, 120000);

      script.onload = () => {
        done();
      };
      script.onerror = onError;

      document.head.appendChild(script);
    } else {
      Promise.resolve(src).then(require).then(resolve, reject);
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
      r: hmrOps ? hmrOps.requireSync(NULL) : requireSync,
      i: hmrOps ? hmrOps.requireAsync(NULL) : requireAsync,
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
  $_BUILD_KEY
);
