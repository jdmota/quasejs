// @flow
/* eslint-disable no-console */
import check from "./commands/check";
import installer from "./commands/installer";
import type { Options } from "./types";
import Store from "./store";
import { read as readPkg, write as writePkg } from "./pkg";

const path = require( "path" );

function showDone() {
  console.log( `\nDone!\n` );
}

function showError( e: Error ) {
  console.error( `\n${e.message}\n` );
  process.exitCode = 1;
  return e;
}

function handleOptions( _opts: Object ): Options {
  const opts = Object.assign( {}, _opts );
  if ( opts.store == null ) {
    opts.store = Store.DEFAULT;
  }
  if ( opts.offline == null && opts.preferOnline == null ) {
    opts.preferOffline = true;
  }
  opts.cache = opts.cache || path.join( opts.store, "cache" );
  opts.folder = _opts.folder ? path.resolve( _opts.folder ) : process.cwd();
  return opts;
}

export function run( command: string, _opts: Object ) {

  const options = handleOptions( _opts );
  const { folder } = options;

  // $FlowIgnore
  if ( options.cliTest ) {
    console.log( command, options );
    return;
  }

  switch ( command ) {

    case "install":
      return installer( options );

    case "upgrade":
      options.update = true;
      return installer( options );

    case "normalizePkg":
      return readPkg( folder ).then( pkg => writePkg( folder, pkg ) ).then( showDone, showError );

    case "check":
      return check( folder );

    default:
      return showError( new Error( `Unknown ${command} command.` ) );
  }

}
