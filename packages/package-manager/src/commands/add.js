// @flow
import type { Options } from "../types";
import { error } from "../utils";
import { parseLoose } from "../resolve";
import { read, readGlobal, write, add, normalizeType } from "../pkg";
import installer from "./installer";

// $FlowIgnore
const latestVersion = require( "latest-version" );
const logSymbols = require( "log-symbols" );

async function inputMapper( required: string ): Promise<{
  alias: string,
  spec: string
}> {

  // Starting from 1 to skip the @ that marks scope
  const versionDelimiter = required.indexOf( "@", 1 );

  if ( versionDelimiter === -1 ) {
    return {
      alias: required,
      spec: `^${await latestVersion( required )}`
    };
  }

  const alias = required.substr( 0, versionDelimiter );
  const spec = required.substr( versionDelimiter + 1 );

  const parsed = parseLoose( alias, spec );

  return {
    alias: parsed.alias,
    spec: parsed.version ?
      parsed.spec :
      `${parsed.spec}@^${await latestVersion( parsed.name )}`
  };
}

/* eslint-disable no-console */

export async function addHelper( options: Options, input: string[] ) {
  const pkg = options.global ? await readGlobal( options.folder ) : await read( options.folder );
  const packages = await Promise.all( input.map( inputMapper ) );
  const added = add( pkg, packages, normalizeType( options.type ) );
  return {
    pkg,
    added
  };
}

export default async function( options: Options, input: string[] ) {
  const { pkg, added } = await addHelper( options, input );
  if ( added.length > 0 ) {
    await write( options.folder, pkg );

    console.log( `${logSymbols.info} Adding:` );
    for ( const { alias, spec } of added ) {
      console.log( `  - ${alias}@${spec}` );
    }
    console.log( "" );
  } else {
    throw error( "Nothing was added" );
  }
  return installer( options );
}
