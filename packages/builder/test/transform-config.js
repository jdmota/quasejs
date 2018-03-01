import JsLanguage from "../src/languages/js";
import babelPlugin from "../src/plugins/babel";

const BABEL_OPTS = {
  babelrc: false,
  parserOpts: {
    sourceType: "module",
    plugins: [
      "classProperties",
      "dynamicImport",
      "exportDefaultFrom",
      "exportNamespaceFrom"
    ]
  },
  presets: [
    [ "@babel/env", {
      targets: { chrome: 50 },
      modules: false,
      loose: true
    } ]
  ]
};

function jsPlugin( options ) {
  return {
    name: "quase_builder_test_js_plugin",
    getLanguage( module, builder ) {
      if ( module.type === "js" ) {
        return new JsLanguage( options, module, builder );
      }
    }
  };
}

export default function( config, fixturePath ) {
  config = config || {};
  config.cwd = fixturePath;
  config.sourceMaps = config.sourceMaps === undefined ? true : config.sourceMaps;
  config.plugins = config.plugins || [];
  config.plugins.push( [ babelPlugin, Object.assign( {}, BABEL_OPTS, config.babelOpts ) ] );
  config.plugins.push( [ jsPlugin, { resolve: config.resolve } ] );
  return config;
}
