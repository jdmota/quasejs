import { Loc } from "../types";

const codeFrameColumns = require( "@babel/code-frame" ).codeFrameColumns;

type ErrorOpts = {
  id?: string;
  code?: string | null;
  loc?: Loc | null;
  codeFrameOptions?: any;
};

interface Error2 extends Error {
  fileName?: string;
  loc?: Loc | null;
  codeFrame?: string;
}

export default function( message: string, { id, code, loc, codeFrameOptions }: ErrorOpts ) {
  const error: Error2 = new Error( message );
  error.fileName = id;
  error.loc = loc;
  error.codeFrame =
    loc && code ? codeFrameColumns( code, { start: { line: loc.line } }, codeFrameOptions ) : "";
  throw error;
}

export function locToString( loc: Loc|null|undefined ) {
  if ( loc ) {
    if ( loc.column != null ) {
      return `${loc.line}:${loc.column}`;
    }
    return `${loc.line}`;
  }
  return "";
}

export function formatError( err: string | Error2 ) {
  if ( typeof err === "string" ) {
    let message = err;
    if ( !message ) {
      message = "Unknown error";
    }
    return {
      message,
      stack: null
    };
  }

  let message = err.message;
  if ( !message ) {
    message = "Unknown error";
  }

  if ( err.fileName ) {
    let fileName = err.fileName;
    if ( err.loc ) {
      fileName += `:${locToString( err.loc )}`;
    }

    message = `${fileName}: ${message}`;
  }

  let stack;
  if ( err.codeFrame ) {
    stack = err.codeFrame;
  } else if ( err.stack ) {
    stack = err.stack.slice( err.stack.indexOf( "\n" ) + 1 );
  }

  return { message, stack };
}
