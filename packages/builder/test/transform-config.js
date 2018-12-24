import { schema } from "../dist/options";

const path = require( "path" );

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

const { apply } = require( "@quase/config" );

const jsPlugin = path.join( __dirname, "../dist/plugins/implementations/js" );
const babelPlugin = path.join( __dirname, "../dist/plugins/implementations/babel" );

export default function( config, fixturePath ) {
  config.mode = config.mode || "development";
  config.cwd = fixturePath;
  config.optimization = Object.assign( {
    hashId: true
  }, config.optimization );
  config.plugins = config.plugins || [];
  config.plugins.push( [ babelPlugin, Object.assign( {}, BABEL_OPTS, config.babelOpts ) ] );
  config.plugins.push( [ jsPlugin, { resolve: config.resolve } ] );
  delete config.resolve;
  delete config.babelOpts;
  return apply( schema, [ config ], [ "config" ] );
}
