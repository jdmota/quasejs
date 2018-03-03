// @flow
import { read as readPkg } from "./pkg";
import {
  shouldReuse as shouldReuseLockfile,
  read as readLockfile
} from "./lockfile";

const fs = require( "fs-extra" );
const path = require( "path" );

function compare( a, b, type ) {

  for ( const name in a ) {
    if ( !b[ name ] ) {
      throw new Error( `Package.json has ${name} but lockfile has not (on ${type})` );
    }
    if ( a[ name ] !== b[ name ].savedVersion ) {
      throw new Error(
        `Package.json has ${name} with version ${a[ name ]} but lockfile has version ${b[ name ].savedVersion} (on ${type})`
      );
    }
  }

  for ( const name in b ) {
    if ( !a[ name ] ) {
      throw new Error( `Lockfile has ${name} but package.json has not (on ${type})` );
    }
  }

}

async function integrity( folder, lockfile ) {

  const checks = [];

  for ( const name in lockfile.deps ) {
    const resolvedObj = lockfile.deps[ name ];
    const idx = resolvedObj.i;
    const hash = lockfile.resolutions[ idx ][ 3 ];
    checks.push( { name, hash } );
  }

  for ( const name in lockfile.devDeps ) {
    const resolvedObj = lockfile.devDeps[ name ];
    const idx = resolvedObj.i;
    const hash = lockfile.resolutions[ idx ][ 3 ];
    checks.push( { name, hash } );
  }

  return Promise.all(
    checks.map( async( { name, hash } ) => {

      const integrityFile = await fs.readFile(
        path.join( folder, "node_modules", name, ".qpm-integrity" ),
        "utf8"
      );

      const integrity = integrityFile.trim();

      if ( integrity !== hash ) {
        throw new Error(
          `Expected integrity ${hash} but found ${integrity} for ${name}`
        );
      }

    } )
  );
}

export default async function( folder: string ) {

  const [ pkg, lockfile ] = await Promise.all( [ readPkg( folder ), readLockfile( folder ) ] );

  if ( !shouldReuseLockfile( lockfile ) ) {
    throw new Error( "Lockfile not found." );
  }

  const dependencies = pkg.dependencies || {};
  const devDependencies = pkg.devDependencies || {};

  compare( dependencies, lockfile.deps, "dependencies" );
  compare( devDependencies, lockfile.devDeps, "devDependencies" );

  await integrity( folder, lockfile );
}
