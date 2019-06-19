const fs = require( "fs-extra" );
const path = require( "path" );
const babel = require( "@babel/core" );
const rollup = require( "rollup" );

/* eslint no-console: 0 */

const babelBaseOpts = {
  filename: "runtime.ts",
  sourceType: "module",
  babelrc: false,
  configFile: false,
  sourceMaps: false,
  ast: false
};

function assertionError() {
  throw new Error( "Assertion error" );
}

async function compileTStoJS( code ) {
  code = code.replace( /\/\/ TO REMOVE[^/]+\/\/ END TO REMOVE/g, "" );
  code = ( await babel.transformAsync( code, {
    ...babelBaseOpts,
    plugins: [
      require( "@babel/plugin-proposal-object-rest-spread" ),
      [ require( "@babel/plugin-proposal-class-properties" ), { loose: true } ]
    ],
    presets: [
      require( "@babel/preset-typescript" ),
      [ require( "@babel/preset-env" ), {
        loose: true,
        targets: {
          node: "8",
          electron: "3",
          // http://browserl.ist/
          browsers: "> 0.4% and last 4 versions, not IE 11"
        }
      } ]
    ]
  } ) ).code;
  return code;
}

async function compileReplace( code, { hmr, withBrowser } ) {
  code = code.replace( /\$_HMR/g, hmr ? `{hostname:$_HMR_HOSTNAME,port:$_HMR_PORT}` : "null" );
  code = code.replace( /\$_WITH_BROWSER/g, withBrowser ? "true" : "false" );
  return code;
}

async function compileTreeshake( code ) {

  const ID = "RUNTIME";

  const bundle = await rollup.rollup( {
    input: ID,
    plugins: [
      {
        resolveId: id => ( id === ID ? id : assertionError() ),
        load: id => ( id === ID ? code : assertionError() )
      }
    ]
  } );

  const { output } = await bundle.generate( {
    format: "esm"
  } );

  for ( const asset of output ) {
    return asset.code;
  }

  assertionError();
}

async function compileMinify( input ) {
  const { code } = await babel.transformAsync( input, {
    ...babelBaseOpts,
    comments: false,
    minified: true,
    presets: [
      [ require( "babel-preset-minify" ), {
        builtIns: false,
        evaluate: false
      } ]
    ]
  } );
  return code.trim();
}

async function compile( builds ) {

  const runtime = await compileTStoJS( await fs.readFile( path.resolve( __dirname, "./runtime.ts" ), "utf8" ) );

  for ( const build of builds ) {
    let code = await compileReplace( runtime, build );
    code = await compileTreeshake( code );
    code = build.minify ? await compileMinify( code ) : code;

    const filename = [
      "runtime",
      build.withBrowser && "browser",
      build.hmr && "hmr",
      build.minify && "min",
      "js"
    ].filter( Boolean ).join( "." );

    const fullFilename = path.join( __dirname, "builds", filename );

    await fs.outputFile( fullFilename, `/* eslint-disable */\n${code}` );

    console.log( fullFilename );
  }
}

compile( [
  {},
  {
    minify: true
  },
  {
    withBrowser: true
  },
  {
    withBrowser: true,
    minify: true
  },
  {
    hmr: true,
    withBrowser: true
  }
] );
