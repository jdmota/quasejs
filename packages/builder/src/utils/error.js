import { locToString } from "./loc";

const codeFrameColumns = require( "@babel/code-frame" ).codeFrameColumns;

export default function( message, { id, code, loc } = {} ) {
  const error = new Error( `${message}${id ? `. See ${id}${loc ? `:${locToString( loc )}` : ""}` : ""}` );
  error.__fromBuilder = true;
  error.loc = loc;
  error.code = loc ? code : null;
  throw error;
}

export function reportText( error, codeFrameOpts ) {
  return `\n${error.__fromBuilder ? error.message : error.stack}\n\n${
    error.loc && error.code ? codeFrameColumns( error.code, { start: { line: error.loc.line } }, codeFrameOpts || {} ) + "\n\n" : ""
  }`;
}

export function report( error, codeFrameOpts ) {
  process.stdout.write( reportText( error, codeFrameOpts ) );
}
