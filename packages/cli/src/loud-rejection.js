// Adapted from https://github.com/sindresorhus/loud-rejection

const util = require( "util" );
const onExit = require( "signal-exit" );
const currentlyUnhandled = require( "currently-unhandled" );
const { printError } = require( "@quase/config" );

let installed = false;

export default function() {
  if ( installed ) {
    return;
  }
  installed = true;

  const listUnhandled = currentlyUnhandled();

  onExit( () => {
    const unhandledRejections = listUnhandled();

    if ( unhandledRejections.length > 0 ) {
      unhandledRejections.forEach( x => {
        let err = x.reason;

        if ( !( err instanceof Error ) ) {
          err = new Error( "Promise rejected with value: " + util.inspect( err ) );
        }

        printError( err );
      } );

      process.exitCode = 1;
    }
  } );
}
