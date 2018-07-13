import { locToString } from "./loc";

const codeFrameColumns = require( "@babel/code-frame" ).codeFrameColumns;
const { getOriginalLocation } = require( "@quase/source-map" );

export default function( message, { id, code, map, originalCode } = {}, loc ) {
  if ( loc && originalCode && map ) {
    const originalLoc = getOriginalLocation( map, loc );
    if ( originalLoc.line != null ) {
      loc = originalLoc;
      code = originalCode;
    }
  }

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
