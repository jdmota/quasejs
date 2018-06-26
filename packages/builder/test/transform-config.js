import { schema } from "../src/options";
import JsLanguage from "../src/languages/js";
import babelPlugin from "../src/plugins/babel";

const BABEL_OPTS = {
  babelrc: false,
  configFile: false,
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

const { applyDefaults } = require( "@quase/config" );

export default function( config, fixturePath ) {
  config.mode = "development";
  config.cwd = fixturePath;
  config.optimization = Object.assign( {
    hashId: true
  }, config.optimization );
  config.plugins = config.plugins || [];
  config.plugins.push( [ babelPlugin, Object.assign( {}, BABEL_OPTS, config.babelOpts ) ] );
  config.plugins.push( [ jsPlugin, { resolve: config.resolve } ] );
  return applyDefaults( schema, config );
}
