const path = require( "path" );
const Module = require( "module" );
const resolver = require( "./resolver" );

require( "@babel/register" )( {
  extensions: [ ".js", ".ts" ]
} );

Module._resolveFilename = function( request, parent /* isMain, options */ ) {
  const filename = resolver( request, {
    basedir: parent ? path.dirname( parent.filename ) : process.cwd()
  } );

  if ( !filename ) {
    const err = new Error( `Cannot find module '${request}'` );
    err.code = "MODULE_NOT_FOUND";
    throw err;
  }
  return filename;
};

// Adapted from from @babel/node

const args = process.argv.slice( 2 );

// Make the filename absolute
const filename = args[ 0 ];
if ( !path.isAbsolute( filename ) ) {
  args[ 0 ] = path.join( process.cwd(), filename );
}

// Add back on node and concat the sliced args
process.argv = [ "node" ].concat( args );
process.execArgv.unshift( __filename );

Module.runMain();
