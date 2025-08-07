import Runner from "./core/runner";

/* global window, document, self */

if (typeof window !== "undefined") {
  const w = window as any;

  const runner = Runner.init(w.quaseUnit ? w.quaseUnit.options : {});

  w.quaseUnit = runner.test;
} else if (typeof process !== "undefined" && typeof module !== "undefined") {
  const g = global as any;

  const runner = Runner.init(
    g.quaseUnit ? g.quaseUnit.options : {},
    g.quaseUnit ? g.quaseUnit._fork : false
  );

  module.exports = module.exports.default = runner.test;
} else if (typeof self !== "undefined") {
  const s = self as any;

  const runner = Runner.init(s.quaseUnit ? s.quaseUnit.options : {});

  s.quaseUnit = runner.test;
}
