import { schema } from "../src/options";
import jsPlugin from "../src/plugins/js";
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
