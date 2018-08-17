import { locToString } from "./loc";

const codeFrameColumns = require( "@babel/code-frame" ).codeFrameColumns;

export default function( providedMsg, { id, code, loc } = {}, codeFrameOpts ) {
  const message = `${providedMsg}${id ? `. See ${id}${loc ? `:${locToString( loc )}` : ""}` : ""}${
    loc && code ? `\n\n${codeFrameColumns( code, { start: { line: loc.line } }, codeFrameOpts )}` : ""
  }`;
  const error = new Error( message );
  error.__fromBuilder = true;
  throw error;
}
