const { realpath } = require( "fs-extra" );
const { dirname } = require( "path" );
const nodeResolve = require( "resolve" );

export default {
  resolveId( importee, importer, bundle ) {
    const resolveOpts = bundle.options.resolve || {};
    const { extensions, pathFilter, paths, moduleDirectory } = resolveOpts;
    const symlinks = resolveOpts.symlinks === undefined ? true : resolveOpts.symlinks;
    const opts = {
      basedir: dirname( importer ),
      package: resolveOpts.package,
      extensions,
      readFile: bundle.fileSystem.readFile,
      isFile: bundle.fileSystem.isFile,
      packageFilter( pkg, path, relativePath ) {
        if ( pkg.module ) {
          pkg.main = pkg.module;
        }
        return resolveOpts.pathFilter ? resolveOpts.pathFilter( pkg, path, relativePath ) : pkg;
      },
      pathFilter,
      paths,
      moduleDirectory,
      preserveSymlinks: false
    };
    return new Promise( ( resolve, reject ) => nodeResolve( importee, opts, ( err, res ) => {
      if ( err ) {
        return resolve( null );
      }
      if ( symlinks ) {
        realpath( res, ( err, resolvedPath ) => {
          if ( err ) {
            reject( err );
          } else {
            resolve( resolvedPath );
          }
        } );
      } else {
        resolve( res );
      }
    } ) );
  },
  load( id, bundle ) {
    return new Promise( ( resolve, reject ) => {
      bundle.fileSystem.readFile( id, ( err, data ) => {
        if ( err ) {
          reject( err );
        } else {
          resolve( data.toString( "utf8" ) );
        }
      } );
    } );
  }
};
