// @flow
/* eslint-disable no-console */

const chalk = require( "chalk" );

export function printWarning( str: string ) {
  console.warn( `${chalk.yellow( str )}\n` );
}

export function printError( error: Error ) {
  let message;
  if ( error.__validation ) {
    message = `${chalk.bold( "Validation Error" )}:\n\n${error.message.replace( /^(?!$)/mg, "  " )}`;
  } else {
    message = error.stack;
  }
  console.error( `${chalk.red( message )}\n` );
  process.exitCode = 1;
}
