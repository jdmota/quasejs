const codeFrameColumns = require( "@babel/code-frame" ).codeFrameColumns;
const { getOriginalLocation } = require( "@quase/source-map" );

export default ( originalMessage, { id, code, map } = {}, loc ) => {
  if ( loc && map ) {
    loc = getOriginalLocation( map, loc );
    loc = loc.line == null ? null : loc;
  }
  const error = new Error( originalMessage + ( loc ? `. See ${id}:${loc.line}:${loc.column}` : "" ) );
  error.loc = loc;
  error.code = loc ? code : null;
  error.originalMessage = originalMessage;
  throw error;
};

export function reportText( error, codeFrameOpts ) {
  return `\n${error.originalMessage || error.message}\n\n${
    error.loc ? codeFrameColumns( error.code, { start: { line: error.loc.line } }, codeFrameOpts || {} ) + "\n\n" : ""
  }`;
}

export function report( error, codeFrameOpts ) {
  process.stdout.write( reportText( error, codeFrameOpts ) );
}
