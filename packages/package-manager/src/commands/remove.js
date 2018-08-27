// @flow
import type { Options } from "../types";
import { error } from "../utils";
import { read, readGlobal, write, remove, normalizeType } from "../pkg";
import installer from "./installer";

/* eslint-disable no-console */

const logSymbols = require( "log-symbols" );

export default async function( options: Options, input: string[] ) {
  const pkg = options.global ? await readGlobal( options.folder ) : await read( options.folder );
  const removed = remove( pkg, input, normalizeType( options.type ) );
  if ( removed.length > 0 ) {
    await write( options.folder, pkg );

    console.log( `${logSymbols.info} Removing:` );
    for ( const { name, version } of removed ) {
      console.log( `  - ${name}@${version}` );
    }
    console.log( "" );
  } else {
    throw error( "Nothing was removed" );
  }
  return installer( options );
}
