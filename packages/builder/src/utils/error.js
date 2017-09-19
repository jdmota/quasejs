import { getOriginalLocation } from "../../../source-map/src";

const codeFrame = require( "babel-code-frame" );

export default ( originalMessage, module, loc ) => {
  if ( loc && module.finalMap ) {
    loc = getOriginalLocation( module.finalMap, loc );
  }
  const error = new Error( originalMessage + ( loc ? `. See ${module.normalizedId}:${loc.line}:${loc.column}` : "" ) );
  error.loc = loc;
  error.originalCode = loc ? module.originalCode : null;
  error.originalMessage = originalMessage;
  throw error;
};

export function reportText( error, codeFrameOpts ) {
  return `\n${error.originalMessage || error.message}\n\n${error.loc ? codeFrame( error.originalCode, error.loc.line, undefined, codeFrameOpts ) + "\n\n" : ""}`;
}

export function report( error, codeFrameOpts ) {
  process.stdout.write( reportText( error, codeFrameOpts ) );
}
