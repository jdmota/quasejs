const fs = require( "fs" );
const resolve = require( "resolve" );

function isLocal( path ) {
  if ( /@quase/.test( path ) ) {
    return !/node_modules/.test( fs.realpathSync( path ) );
  }
  return false;
}

function toLocal( path ) {
  if ( /@quase/.test( path ) ) {
    return fs.realpathSync( path );
  }
  return path;
}

module.exports = function( path, options ) {
  const resolved = resolve.sync( path, {
    basedir: options.basedir,
    extensions: options.extensions,
    moduleDirectory: options.moduleDirectory,
    paths: options.paths,
    rootDir: options.rootDir,
    preserveSymlinks: false,
    packageFilter( pkg, path ) {
      if ( pkg.module && isLocal( path ) ) {
        pkg.main = pkg.module;
      }
      return pkg;
    }
  } );
  return resolved && toLocal( resolved );
};
