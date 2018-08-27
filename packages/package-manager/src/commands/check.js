// @flow
import { CheckReporter } from "../reporters/check";
import { type Name, toStr } from "../types";
import { error, readJSON } from "../utils";
import { read as readPkg } from "../pkg";
import { shouldReuse as shouldReuseLockfile, read as readLockfile } from "../lockfile";

const path = require( "path" );

function compare( a, b, type ) {

  for ( const nameStr in a ) {
    // $FlowIgnore
    const name: Name = nameStr;

    if ( !b[ name ] ) {
      throw error( `Package.json has ${nameStr} but lockfile has not (on ${type}).` );
    }
    if ( a[ name ] !== b[ name ].savedVersion ) {
      throw error(
        `Package.json has ${nameStr} with version ${a[ name ]} but lockfile has version ${toStr( b[ name ].savedVersion )} (on ${type}).`
      );
    }
  }

  for ( const nameStr in b ) {
    // $FlowIgnore
    const name: Name = nameStr;

    if ( !a[ name ] ) {
      throw error( `Lockfile has ${nameStr} but package.json has not (on ${type}).` );
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
        throw error( `It seems that ${pkg} is not installed.` );
      }

      if ( integrity !== hash ) {
        throw error(
          `Expected integrity ${toStr( hash )} but found ${integrity} for ${pkg}.`
        );
      }

    } )
  );
}

export class Checker {

  +reporter: CheckReporter;

  constructor( reporter: CheckReporter ) {
    this.reporter = reporter;
  }

  async check( folder: string ) {

    this.reporter.start();

    const [ pkg, lockfile ] = await Promise.all( [ readPkg( folder ), readLockfile( folder ) ] );

    if ( !shouldReuseLockfile( lockfile ) ) {
      this.reporter.warning( {
        code: "LOCKFILE_NOT_FOUND",
        message: "Lockfile not found."
      } );
      return;
    }

    const dependencies = pkg.dependencies || {};
    const devDependencies = pkg.devDependencies || {};

    this.reporter.comparing( "dependencies" );

    compare( dependencies, lockfile.deps, "dependencies" );

    this.reporter.comparing( "devDependencies" );

    compare( devDependencies, lockfile.devDeps, "devDependencies" );

    this.reporter.integrity();

    await integrity( folder, lockfile );
  }

}

export default function( folder: string ) {
  const reporter = new CheckReporter();
  const checker = new Checker( reporter );
  return checker.check( folder ).then( () => {
    reporter.done();
  }, err => {
    reporter.error( err );
  } );
}
