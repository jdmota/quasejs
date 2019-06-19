import { printError } from "./utils";

// Adapted from https://github.com/sindresorhus/hard-rejection

const util = require( "util" );

let installed = false;

export default function() {
  if ( installed ) {
    return;
  }
  installed = true;

  process.on( "unhandledRejection", error => {
    if ( error instanceof Error ) {
      printError( error );
    } else {
      printError( new Error( `Promise rejected with value: ${util.inspect( error )}` ) );
    }
    process.exit( 1 );
  } );
}
