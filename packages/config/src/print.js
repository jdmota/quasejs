// @flow
/* eslint-disable no-console */

const turbocolor = require( "turbocolor" );

export function printWarning( str: string ) {
  console.warn( `${turbocolor.yellow( str )}\n` );
}

export function printError( error: Error ) {
  let message;
  // $FlowIgnore
  if ( error.__validation ) {
    message = `${turbocolor.bold( "Validation Error" )}:\n\n${error.message.replace( /^(?!$)/mg, "  " )}`;
  } else {
    message = error.stack;
  }
  console.error( `${turbocolor.red( message )}\n` );
  process.exitCode = 1;
}
