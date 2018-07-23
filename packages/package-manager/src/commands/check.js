// @flow
import { type Name, toStr } from "../types";
import { readJSON } from "../utils";
import { read as readPkg } from "../pkg";
import { shouldReuse as shouldReuseLockfile, read as readLockfile } from "../lockfile";

const path = require( "path" );

function compare( a, b, type ) {

  for ( const nameStr in a ) {
    // $FlowIgnore
    const name: Name = nameStr;

    if ( !b[ name ] ) {
      throw new Error( `Package.json has ${nameStr} but lockfile has not (on ${type})` );
    }
    if ( a[ name ] !== b[ name ].savedVersion ) {
      throw new Error(
        `Package.json has ${nameStr} with version ${a[ name ]} but lockfile has version ${toStr( b[ name ].savedVersion )} (on ${type})`
      );
    }
  }

  for ( const nameStr in b ) {
    // $FlowIgnore
    const name: Name = nameStr;

    if ( !a[ name ] ) {
      throw new Error( `Lockfile has ${nameStr} but package.json has not (on ${type})` );
    }
  }

}

async function integrity( folder, lockfile ) {

  const checks = [];

  for ( const nameStr in lockfile.deps ) {
    // $FlowIgnore
    const name: Name = nameStr;

    const resolvedObj = lockfile.deps[ name ];
    const idx = resolvedObj.i;
    const hash = lockfile.resolutions[ idx ][ 3 ];
    checks.push( { name, hash } );
  }

  for ( const nameStr in lockfile.devDeps ) {
    // $FlowIgnore
    const name: Name = nameStr;

    const resolvedObj = lockfile.devDeps[ name ];
    const idx = resolvedObj.i;
    const hash = lockfile.resolutions[ idx ][ 3 ];
    checks.push( { name, hash } );
  }

  return Promise.all(
    checks.map( async( { name, hash } ) => {

      // TODO report if the file does not exist
      // TODO check folder integrity?

      const { integrity } = await readJSON(
        path.join( folder, "node_modules", name, ".qpm" )
      );

      if ( integrity !== hash ) {
        throw new Error(
          `Expected integrity ${toStr( hash )} but found ${toStr( integrity )} for ${name}`
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
