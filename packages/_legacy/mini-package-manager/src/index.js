// @flow
import { execOnInternal, execOnFolder, execOnBoth, copyMaybe, crawl } from "./utils";
import { before as npmBefore, after as npmAfter, normalize as npmNormalize } from "./npm";

const path = require( "path" );
const fs = require( "fs-extra" );
const crypto = require( "crypto" );
const homedir = require( "os" ).homedir();
const readPkgUp = require( "read-pkg-up" );

function connectNodeModules( deps: Set<string>, fromBase: string, toBase: string ) {
  const promises = [];

  for ( const dep of deps ) {

    const _from = path.join( fromBase, "node_modules", dep );
    const to = path.join( toBase, "node_modules", dep );

    promises.push(
      fs.pathExists( _from ).then( exists => {
        if ( exists ) {
          return crawl( _from, item => {
            if ( item.stats.isFile() ) {
              const relative = path.relative( _from, item.path );
              const dest = path.resolve( to, relative );
              return (
                /\.js$/.test( dest ) || !/\..+$/.test( dest ) ?
                  fs.outputFile( dest, `module.exports=require(${JSON.stringify( item.path )});` ) :
                  fs.copy( item.path, dest )
              );
            }
          } );
        }
      } )
    );
  }

  return Promise.all( promises );
}

function exec( command: string, args: string[], folder: string, internal: string ) {

  const thing = npmNormalize( command );

  if ( Array.isArray( thing ) ) {
    return execOnBoth( thing, args, folder, internal );
  }

  if ( thing ) {
    return execOnInternal( command, args, folder, internal );
  }

  return execOnFolder( command, args, folder );
}

// TODO https://stackoverflow.com/questions/14742553/npm-local-install-package-to-custom-location
// TODO https://github.com/yarnpkg/yarn/issues/1684

// modules in ./npm_modules/node_modules
// npm install slash --prefix ./npm_modules

// modules in ./yarn_modules
// yarn add slash --modules-folder ./yarn_modules

export default async function( command: string, args: string[] ) {

  const { pkg, path: pkgPath } = readPkgUp();

  const folder = path.join( pkgPath, ".." );
  const folderName = path.basename( folder );

  const refPath = path.join( folder, ".quase-mini-package-manager" );

  let refExisted = false;
  let ref;

  try {
    ref = await fs.readFile( refPath, "utf8" );
    refExisted = true;
  } catch ( err ) {
    if ( err.code === "ENOENT" ) {
      ref = `${folderName}-${crypto.createHash( "md5" ).update( Date.now() + "", "utf8" ).digest( "hex" )}`;
    } else {
      throw err;
    }
  }

  const internal = path.join( homedir, "quase-mini-package-manager", ref );

  await fs.ensureDir( internal );

  await copyMaybe( folder, internal, npmBefore );

  if ( !refExisted ) {
    await fs.writeFile( refPath, ref );
  }

  await exec( command, args, folder, internal );

  await copyMaybe( internal, folder, npmAfter );

  const deps = new Set();

  for ( const kind of [ "dependencies", "devDependencies", "peerDependencies", "optionalDependencies" ] ) {
    for ( const name in Object( pkg[ kind ] ) ) {
      deps.add( name );
    }
  }

  await connectNodeModules( deps, internal, folder );

}
