// @flow
import reporter from "../reporters/check";
import { type Name, toStr } from "../types";
import { readJSON } from "../utils";
import { read as readPkg } from "../pkg";
import { shouldReuse as shouldReuseLockfile, read as readLockfile } from "../lockfile";

const path = require( "path" );
const { EventEmitter } = require( "events" );

function compare( a, b, type ) {

  for ( const nameStr in a ) {
    // $FlowIgnore
    const name: Name = nameStr;

    if ( !b[ name ] ) {
      throw new Error( `Package.json has ${nameStr} but lockfile has not (on ${type}).` );
    }
    if ( a[ name ] !== b[ name ].savedVersion ) {
      throw new Error(
        `Package.json has ${nameStr} with version ${a[ name ]} but lockfile has version ${toStr( b[ name ].savedVersion )} (on ${type}).`
      );
    }
  }

  for ( const nameStr in b ) {
    // $FlowIgnore
    const name: Name = nameStr;

    if ( !a[ name ] ) {
      throw new Error( `Lockfile has ${nameStr} but package.json has not (on ${type}).` );
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
    const version = lockfile.resolutions[ idx ][ 1 ];
    const hash = lockfile.resolutions[ idx ][ 3 ];
    checks.push( { pkg: `${nameStr}@${toStr( version )}`, name, hash } );
  }

  for ( const nameStr in lockfile.devDeps ) {
    // $FlowIgnore
    const name: Name = nameStr;

    const resolvedObj = lockfile.devDeps[ name ];
    const idx = resolvedObj.i;
    const version = lockfile.resolutions[ idx ][ 1 ];
    const hash = lockfile.resolutions[ idx ][ 3 ];
    checks.push( { pkg: `${nameStr}@${toStr( version )}`, name, hash } );
  }

  return Promise.all(
    checks.map( async( { pkg, name, hash } ) => {

      // TODO check folder integrity?

      const { integrity } = await readJSON(
        path.join( folder, "node_modules", name, ".qpm" )
      );

      if ( integrity === undefined ) {
        throw new Error( `It seems that ${pkg} is not installed.` );
      }

      if ( integrity !== hash ) {
        throw new Error(
          `Expected integrity ${toStr( hash )} but found ${integrity} for ${pkg}.`
        );
      }

    } )
  );
}

export class Checker extends EventEmitter {

  async check( folder: string ) {

    this.emit( "start" );

    const [ pkg, lockfile ] = await Promise.all( [ readPkg( folder ), readLockfile( folder ) ] );

    if ( !shouldReuseLockfile( lockfile ) ) {
      throw new Error( "Lockfile not found." );
    }

    const dependencies = pkg.dependencies || {};
    const devDependencies = pkg.devDependencies || {};

    this.emit( "comparing", "dependencies" );

    compare( dependencies, lockfile.deps, "dependencies" );

    this.emit( "comparing", "devDependencies" );

    compare( devDependencies, lockfile.devDeps, "devDependencies" );

    this.emit( "integrity" );

    await integrity( folder, lockfile );

    this.emit( "done" );
  }

}

export default function( folder: string ) {
  const checker = new Checker();
  reporter( checker );
  return checker.check( folder );
}
