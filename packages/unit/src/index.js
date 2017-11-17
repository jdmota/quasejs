import Runner from "./core/runner";

/* global window, document, self */

if ( typeof window !== "undefined" ) {

  const runner = Runner.init( window.quaseUnit ? window.quaseUnit.options : {} );

  window.quaseUnit = runner.test;

} else if ( typeof process !== "undefined" && typeof module !== "undefined" ) {

  const runner = Runner.init( global.quaseUnit ? global.quaseUnit.options : {} );

  module.exports = module.exports.default = runner.test;

} else if ( typeof self !== "undefined" ) {

  const runner = Runner.init( self.quaseUnit ? self.quaseUnit.options : {} );

  self.quaseUnit = runner.test;

}
