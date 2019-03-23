const path = require( "path" );
const resolve = require( "resolve" );
const pnp = require( "../.pnp.js" );
const extensions = [ ".js", ".ts", ".json" ];

function r( request, basedir ) {
  return resolve.sync( request, {
    basedir,
    extensions,
    packageFilter( pkg ) {
      if ( pkg.module ) {
        pkg.main = pkg.module;
      }
      return pkg;
    }
  } );
}

module.exports = function( request, options ) {

  let basedir = options.basedir;
  if ( basedir.charAt( basedir.length - 1 ) !== "/" ) {
    basedir = `${basedir}/`;
  }

  if ( path.isAbsolute( request ) || /^\.\.?(\/|$)/.test( request ) ) {
    return r( request, basedir );
  }

  // So that we can defer to the file specified in "module" in the package.json
  if ( /^@quase\/[^/]+$/.test( request ) ) {
    const manifestPath = pnp.resolveToUnqualified( `${request}/package.json`, basedir );
    const isLocal = !/node_modules/.test( manifestPath );

    if ( isLocal ) {
      const folder = path.dirname( manifestPath );
      return r( folder, basedir );
    }
  }

  const resolution = pnp.resolveRequest( request, basedir, { extensions } );
  if ( resolution === null ) {
    return request;
  }
  return resolution;
};
