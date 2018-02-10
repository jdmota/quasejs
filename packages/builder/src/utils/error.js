import { locToString } from "./loc";

const codeFrameColumns = require( "@babel/code-frame" ).codeFrameColumns;
const { joinSourceMaps, getOriginalLocation } = require( "@quase/source-map" );

export default function( originalMessage, { id, code, mapChain, originalCode } = {}, loc ) {
  if ( loc && originalCode && mapChain ) {
    const finalMap = joinSourceMaps( mapChain );
    if ( finalMap ) {
      const originalLoc = getOriginalLocation( finalMap, loc );
      if ( originalLoc.line != null ) {
        loc = originalLoc;
        code = originalCode;
      }
    }
  }

  const error = new Error( `${originalMessage}${id ? `. See ${id}${loc ? `:${locToString( loc )}` : ""}` : ""}` );
  error.__fromBuilder = true;
  error.loc = loc;
  error.code = loc ? code : null;
  error.originalMessage = originalMessage;
  throw error;
}

export function reportText( error, codeFrameOpts ) {
  return `\n${error.__fromBuilder ? error.originalMessage : error.stack}\n\n${
    error.loc && error.code ? codeFrameColumns( error.code, { start: { line: error.loc.line } }, codeFrameOpts || {} ) + "\n\n" : ""
  }`;
}

export function report( error, codeFrameOpts ) {
  process.stdout.write( reportText( error, codeFrameOpts ) );
}
