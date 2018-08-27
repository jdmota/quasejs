// @flow
import type { Options } from "../types";
import { error } from "../utils";
import { read, readGlobal, write, add, normalizeType } from "../pkg";
import installer from "./installer";

// $FlowIgnore
const latestVersion = require( "latest-version" );
const semver = require( "semver" );

async function inputMapper( required: string ): Promise<{ name: string, version: string }> {
  const i = required.lastIndexOf( "@" );

  if ( i <= 0 ) {
    const name = required.trim();

    return {
      name,
      version: await latestVersion( name )
    };
  }

  const name = required.slice( 0, i ).trim();
  const version = required.slice( i + 1 ).trim();

  const validatedRange = semver.validRange( version );

  if ( validatedRange == null ) {
    throw error( `Invalid version/range for ${name}` );
  }

  return {
    name,
    version: validatedRange
  };
}

/* eslint-disable no-console */

export default async function( options: Options, input: string[] ) {
  const pkg = options.global ? await readGlobal( options.folder ) : await read( options.folder );
  const packages = await Promise.all( input.map( inputMapper ) );
  const added = add( pkg, packages, normalizeType( options.type ) );
  if ( added.length > 0 ) {
    await write( options.folder, pkg );

    console.log( "Adding:" );
    for ( const { name, version } of added ) {
      console.log( `  ${name}@${version}` );
    }
    console.log( "" );
  } else {
    throw error( "Nothing was added" );
  }
  return installer( options );
}
