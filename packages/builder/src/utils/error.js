const codeFrameColumns = require( "@babel/code-frame" ).codeFrameColumns;

export default function( message, { id, code, loc, codeFrameOptions } = {} ) {
  const error = new Error( message );
  error.fileName = id;
  error.loc = loc;
  error.codeFrame =
    loc && code ? codeFrameColumns( code, { start: { line: loc.line } }, codeFrameOptions ) : "";
  throw error;
}

export function locToString( loc ) {
  if ( loc ) {
    if ( loc.column != null ) {
      return `${loc.line}:${loc.column}`;
    }
    return `${loc.line}`;
  }
  return "";
}

export function formatError( err ) {
  let message = typeof err === "string" ? err : err.message;
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
