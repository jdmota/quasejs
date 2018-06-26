/* eslint-disable camelcase, node/no-extraneous-require */

// This file exists to make sure we require @babel/core.
// It seems that jest-runtime is importing babel-core@6 first,
// and later, babel-core requires resolve to that and not babel-core@7
// And there seems to be other issues, since now babel supports "babel.config.js"

const crypto = require( "crypto" );
const fs = require( "fs" );
const path = require( "path" );
const babelCore = require( "@babel/core" );

const BABELCONFIG_FILENAME = "babel.config.js";
const THIS_FILE = fs.readFileSync( __filename );

const createTransformer = () => {
  const config = fs.readFileSync( path.join( process.cwd(), BABELCONFIG_FILENAME ), "utf8" );

  return {
    canInstrument: false,
    getCacheKey( fileData, filename, configString, { instrument, rootDir } ) {
      return crypto
        .createHash( "md5" )
        .update( THIS_FILE )
        .update( "\0", "utf8" )
        .update( fileData )
        .update( "\0", "utf8" )
        .update( path.relative( rootDir, filename ) )
        .update( "\0", "utf8" )
        .update( configString )
        .update( "\0", "utf8" )
        .update( config )
        .update( "\0", "utf8" )
        .update( instrument ? "instrument" : "" )
        .digest( "hex" );
    },
    process( src, filename ) {
      // babel v7 might return null in the case when the file has been ignored.
      return babelCore.transformSync( src, { filename, compact: false, sourceMaps: "both" } ) || src;
    }
  };
};

module.exports = createTransformer();
module.exports.createTransformer = createTransformer;
