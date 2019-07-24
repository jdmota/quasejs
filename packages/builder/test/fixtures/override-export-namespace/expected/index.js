"use strict";({g:"undefined"==typeof self?Function("return this")():self,p(m,f){(this.g.__quase_builder__=this.g.__quase_builder__||{q:[]}).q.push([m,f])}}).p({
"0cc20":function(_$){var _export = _$.r("5d4f5");

console.log(_export.foo);
},
"5d4f5":function(_$){var _a = _$.r("67adc");

var _b = _$.r("a4db4");

_$.a(e, _a);

_$.a(e, _b);
},
"67adc":function(_$){_$.g(_$.e, "foo", function () {
  return foo;
});

const foo = "a";
},
a4db4:function(_$){_$.g(_$.e, "foo", function () {
  return foo;
});

const foo = "b";
}});"use strict";


/* globals self */

/* eslint no-console: 0, @typescript-eslint/camelcase: 0 */
(function (global, nodeRequire) {
  // Help reduce minified size
  const UNDEFINED = undefined;
  const NULL = null;
  const {
    document,
    location,
    importScripts
  } = global;
  const isBrowser = global.window === global;

  const blank = () => Object.create(NULL);

  const modules = blank();
  const fnModules = blank(); // Functions that load the module

  const fileImports = blank(); // Files that were imported already

  const fetches = blank(); // Fetches

  const publicPath = nodeRequire ? "./" : "";
  const moduleToFiles = blank();

  function require(id) {
    if (id) {
      if (importScripts) {
        importScripts(id);
      } else if (nodeRequire) {
        nodeRequire(id);
      }
    }

    return NULL;
  }

  function pushInfo(moreInfo) {
    const files = moreInfo.f;
    const mToFiles = moreInfo.m;

    for (const id in mToFiles) {
      moduleToFiles[id] = mToFiles[id].map(f => publicPath + files[f]);
    }
  }

  function pushModules(moreModules) {
    for (const id in moreModules) {
      if (fnModules[id] === UNDEFINED) {
        fnModules[id] = moreModules[id];
      }
    }
  }

  function push(arg) {
    if (arg[1]) pushInfo(arg[1]);
    pushModules(arg[0]);
  }

  function exportHelper(e, name, get) {
    Object.defineProperty(e, name, {
      enumerable: true,
      get
    });
  }

  function exportAllHelper(e, o) {
    Object.keys(o).forEach(k => {
      if (k === "default" || k === "__esModule") return;
      Object.defineProperty(e, k, {
        configurable: true,
        enumerable: true,
        get: () => o[k]
      });
    });
  }

  function exists(id) {
    return !!(modules[id] || fnModules[id]);
  }

  const load = id => {
    const curr = modules[id];

    if (curr) {
      return curr;
    }

    const fn = fnModules[id];
    {
      fnModules[id] = NULL;
    }

    if (fn) {
      const moduleExports = {
        __esModule: true
      };
      modules[id] = moduleExports;
      {
        fn({
          e: moduleExports,
          r: requireSync,
          i: requireAsync,
          g: exportHelper,
          a: exportAllHelper,
          m: {}
        });
      }
      return moduleExports;
    }

    const err = new Error("Cannot find module " + id);
    err.code = "MODULE_NOT_FOUND";
    throw err;
  };

  function requireSync(id) {
    if (!exists(id)) {
      (moduleToFiles[id] || []).forEach(importFileSync);
    }

    return load(id);
  }

  requireSync.r = id => {
    const e = requireSync(id);
    return e.__esModule === false ? e["default"] : e;
  };

  function requireAsync(id) {
    return Promise.all(exists(id) ? [] : (moduleToFiles[id] || []).map(importFileAsync)).then(() => load(id));
  }

  function importFileSync(file) {
    if (fileImports[file] === UNDEFINED) {
      fileImports[file] = require(file);
    }

    return fileImports[file];
  }

  function importFileAsync(src) {
    if (fileImports[src] !== UNDEFINED) {
      return Promise.resolve(fileImports[src]);
    }

    if (fetches[src]) {
      return fetches[src];
    }

    let resolve;
    let reject;
    const promise = new Promise((a, b) => {
      resolve = a;
      reject = b;
    });
    const resolution = [exported => {
      fetches[src] = UNDEFINED;
      resolve(fileImports[src] = exported);
    }, err => {
      fetches[src] = UNDEFINED;
      reject(err);
    }];
    fetches[src] = promise;

    if (isBrowser && document) {
      const script = document.createElement("script");
      script.type = "text/javascript";
      script.charset = "utf-8";
      script.async = true;
      script.src = src;
      let timeout;

      const done = err => {
        clearTimeout(timeout); // @ts-ignore

        script.onerror = script.onload = NULL; // Avoid memory leaks in IE

        if (err) {
          resolution[1](err);
        } else {
          resolution[0](NULL);
        }
      };

      const onError = () => {
        done(new Error("Fetching " + src + " failed"));
      };

      timeout = setTimeout(onError, 120000);

      script.onload = () => {
        done();
      };

      script.onerror = onError;
      document.head.appendChild(script);
    } else {
      Promise.resolve(src).then(require).then(resolution[0], resolution[1]);
    }

    return promise;
  }

  let me = global.__quase_builder__;

  if (me) {
    if (Array.isArray(me.q)) {
      for (let i = 0; i < me.q.length; i++) {
        push(me.q[i]);
      }

      me.r = requireSync;
      me.i = requireAsync;
      me.q = {
        push
      };
    }
  } else {
    me = global.__quase_builder__ = {
      r: requireSync,
      i: requireAsync,
      q: {
        push
      }
    };
  }

  return me.r;
})( // eslint-disable-next-line no-new-func
typeof self !== "undefined" ? self : Function("return this")(), typeof require !== "undefined" && require)('0cc20');
//# sourceMappingURL=index.js.map