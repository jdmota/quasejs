// @flow
import type { Loc } from "../types";
import { locToString } from "./loc";

const codeFrameColumns = require( "@babel/code-frame" ).codeFrameColumns;
const { getOriginalLocation } = require( "@quase/source-map" );

export default ( originalMessage: string, { id, code, map }: { id: string, code?: ?string, map?: ?Object } = {}, loc: ?Loc ) => {
  if ( loc && map ) {
    loc = getOriginalLocation( map, loc );
    loc = loc.line == null ? null : loc;
  }
  const error: Object = new Error( originalMessage + ( loc ? `. See ${id}:${locToString( loc )}` : "" ) );
  error.__fromBuilder = true;
  error.loc = loc;
  error.code = loc ? code : null;
  error.originalMessage = originalMessage;
  throw error;
};

export function reportText( error: Object, codeFrameOpts: ?Object ): string {
  return `\n${error.__fromBuilder ? error.originalMessage || error.message : error.stack}\n\n${
    error.loc && error.code ? codeFrameColumns( error.code, { start: { line: error.loc.line } }, codeFrameOpts || {} ) + "\n\n" : ""
  }`;
}

export function report( error: Object, codeFrameOpts: ?Object ) {
  process.stdout.write( reportText( error, codeFrameOpts ) );
}
