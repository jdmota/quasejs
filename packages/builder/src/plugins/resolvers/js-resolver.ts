import { Resolver } from "../../types";

const importLazy = require( "import-lazy" )( require );
const path = require( "path" );
const nodeResolve = importLazy( "resolve" );

const RESOLVER_NAME = "quase_builder_js_resolver";

export const resolver: Resolver = {

  name: RESOLVER_NAME,

  resolve( options, importee: string, importerUtils ) {
    const resolveOpts = options.resolve || {};
    const { extensions, pathFilter, paths, moduleDirectory } = resolveOpts;
    const opts = {
      basedir: path.dirname( importerUtils.path ),
      package: resolveOpts.package,
      extensions,
      async readFile( file: string, cb: any ) {
        try {
          cb( null, await importerUtils.readFile( file ) );
        } catch ( err ) {
          cb( err );
        }
      },
      async isFile( file: string, cb: any ) {
        try {
          cb( null, await importerUtils.isFile( file ) );
        } catch ( err ) {
          cb( err );
        }
      },
      packageFilter( pkg: any, path: string ) {
        if ( pkg.module ) {
          pkg.main = pkg.module;
        }
        return resolveOpts.pathFilter ? resolveOpts.pathFilter( pkg, path ) : pkg;
      },
      pathFilter,
      paths,
      moduleDirectory,
      preserveSymlinks: false,
      forceNodeResolution: true // Because of Yarn's PnP
    };
    return new Promise( ( resolve, reject ) => nodeResolve( importee, opts, ( err: any, res: any ) => {
      if ( err ) {
        if ( err.code === "MODULE_NOT_FOUND" ) {
          resolve( null );
        } else {
          reject( err );
        }
      } else {
        resolve( res );
      }
    } ) );
  }

};

export default resolver;
