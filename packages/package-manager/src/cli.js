// @flow
/* eslint-disable no-console */

import installer from "../src/installer";
import check from "../src/check";
import init from "../src/init";
import { read as readPkg, write as writePkg } from "../src/pkg";

const path = require( "path" );

function showDone() {
  console.log( `\nDone!\n` );
}

function showError( e: Error ) {
  console.error( `\n${e.message}\n` );
  process.exitCode = 1;
}

export function run( input: string[], flags: Object ) {

  const command = input[ 0 ] || "install";
  const folder = flags.folder ? path.resolve( flags.folder ) : process.cwd();

  switch ( command ) {

    case "install":
      installer( folder, flags ).then( showDone, showError );
      break;

    case "upgrade":
      flags.update = true;
      installer( folder, flags ).then( showDone, showError );
      break;

    case "normalize-pkg": {
      readPkg( folder ).then( pkg => writePkg( folder, pkg ) ).then( showDone, showError );
      break;
    }

    case "check":
      check( folder ).then( showDone, showError );
      break;

    case "init":
      init( folder, input[ 1 ] ).then( showDone, showError );
      break;

    default:
      showError( new Error( `Unknown ${command} command.` ) );
  }

}
