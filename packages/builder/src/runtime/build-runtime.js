const path = require( "path" );
const fs = require( "fs" );
const babel = require( "babel-core" );

const input = fs.readFileSync( path.join( __dirname, "runtime.js" ), "utf8" );

const { code } = babel.transform( input, {
  babelrc: false,
  presets: [
    require( "babel-preset-es2015" ),
    [ require( "babel-preset-minify" ), {
      evaluate: false
    } ]
  ],
  comments: false,
  sourceMaps: false,
  minified: true
} );

fs.writeFileSync( path.join( __dirname, "runtime.min.js" ), "\"use strict\";" + code.trim() );

/* eslint-disable no-console */

console.log( "Testing..." );

require( path.join( __dirname, "runtime.min.js" ) );

global.__quase_builder__.a( {
  _0: function() {
    console.log( "Called!" );
  }
} );

global.__quase_builder__.r( "_0" );

console.log( "Done!" );
