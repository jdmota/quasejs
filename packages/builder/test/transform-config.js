import { schema, handleOptions } from "../dist/options";

const path = require( "path" );
const pnp = require( "../../../.pnp.js" );

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
    [ "@babel/preset-env", {
      targets: { chrome: 50 },
      modules: false,
      loose: true
    } ]
  ]
};

const schemaCompiler = require( "@quase/schema/dist/compiler" ).default;
const compiledSchema = schemaCompiler( schema );
const schemaFn = eval( compiledSchema ); // eslint-disable-line no-eval

const jsPlugin = path.join( __dirname, "../dist/plugins/implementations/js" );
const babelPlugin = path.join( __dirname, "../dist/plugins/implementations/babel" );

function handlePlugins( plugins ) {
  return plugins.map( p => {
    if ( typeof p === "string" ) {
      return pnp.resolveRequest( p, __dirname, { extensions: [ ".js" ] } );
    }
    if ( Array.isArray( p ) ) {
      if ( typeof p[ 0 ] === "string" ) {
        p[ 0 ] = pnp.resolveRequest( p[ 0 ], __dirname, { extensions: [ ".js" ] } );
      }
    }
    return p;
  } );
}

export default function( config, fixturePath ) {
  config.mode = config.mode || "development";
  config.cwd = fixturePath;
  config.optimization = Object.assign( {
    hashId: true
  }, config.optimization );
  config.plugins = config.plugins || [];

  const finalBabelOpts = Object.assign( {}, BABEL_OPTS, config.babelOpts );
  finalBabelOpts.plugins = handlePlugins( finalBabelOpts.plugins || [] );
  finalBabelOpts.presets = handlePlugins( finalBabelOpts.presets || [] );

  config.plugins.push( [ babelPlugin, finalBabelOpts ] );
  config.plugins.push( [ jsPlugin, { resolve: config.resolve } ] );
  delete config.resolve;
  delete config.babelOpts;

  return handleOptions( schemaFn.validateAndMerge( {}, config ) );
}
