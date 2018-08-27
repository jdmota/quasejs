// @flow
/* eslint-disable no-console */
import check from "./commands/check";
import installer from "./commands/installer";
import add from "./commands/add";
import remove from "./commands/remove";
import normalizePkg from "./commands/normalize-pkg";
import { error } from "./utils";
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
  opts.production = opts.production == null ? process.env.NODE_ENV === "production" : opts.production;

  if ( opts.global ) {
    if ( opts.folder ) {
      throw error( "Cannot use --global and --folder at the same time" );
    }
    if ( opts.type ) {
      throw error( "Cannot use --global and --type at the same time" );
    }
    opts.folder = path.resolve( opts.store, "global" );
  } else {
    opts.folder = _opts.folder ? path.resolve( _opts.folder ) : process.cwd();
  }
  return opts;
}

export function run( command: string, _opts: Object, input: string[] ) {

  const options = handleOptions( _opts );
  const { folder } = options;

  switch ( command ) {

    case "install":
      return installer( options );

    case "upgrade":
      return installer( options, true );

    case "add":
      return add( options, input ).catch( showError );

    case "remove":
      return remove( options, input ).catch( showError );

    case "normalizePkg":
      return normalizePkg( folder ).then( showDone, showError );

    case "check":
      return check( folder );

    default:
      return showError( new Error( `Unknown ${command} command.` ) );
  }

}
