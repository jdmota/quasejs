// @flow
/* eslint-disable no-console */
import check from "./commands/check";
import installer from "./commands/installer";
import normalizePkg from "./commands/normalize-pkg";
import type { Options } from "./types";
import Store from "./store";

const path = require( "path" );

function showDone() {
  console.log( `\nDone!\n` );
}

function showError( e: Object ) {
  console.error( `\n${e.__fromManager ? e.message : e.stack}\n` );
  process.exitCode = 1;
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

  switch ( command ) {

    case "install":
      return installer( options );

    case "upgrade":
      return installer( options, true );

    case "normalizePkg":
      return normalizePkg( folder ).then( showDone, showError );

    case "check":
      return check( folder );

    default:
      return showError( new Error( `Unknown ${command} command.` ) );
  }

}
