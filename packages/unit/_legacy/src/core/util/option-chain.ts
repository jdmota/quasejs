// Modified version of https://github.com/avajs/option-chain/blob/master/index.js

const noop = () => {};

export default function (options: any, fn: any, ctx: any, objTarget?: any) {
  function extend(target: any, data: any, ctx?: any) {
    Object.keys(options.methods).forEach(key => {
      Object.defineProperty(target, key, {
        enumerable: true,
        configurable: true,
        get: function () {
          return wrap(data, options.methods[key], ctx || this);
        },
      });
    });

    Object.defineProperty(target, "runner", {
      enumerable: true,
      configurable: true,
      get: function () {
        return ctx || this;
      },
    });

    return target;
  }

  function wrap(prevData: any, method: any, ctx: any) {
    const data = Object.assign({}, prevData);
    method(data);

    function wrapped(arg0: any, arg1: any) {
      // @ts-ignore
      return fn.call(ctx || this, Object.assign({}, data), arg0, arg1);
    }

    return extend(wrapped, data, ctx);
  }

  if (objTarget) {
    return extend(objTarget, options.defaults);
  }

  return wrap(options.defaults, noop, ctx);
}
