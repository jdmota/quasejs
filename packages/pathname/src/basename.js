import { memoizeStringOnly } from "./memoize-string";
import escapeRegExp from "./escape-regexp";
import { normalizeArr } from "./normalize";
import { split, assertPath } from "./vars";

const createReExt = memoizeStringOnly( function( ext ) {
  return new RegExp( escapeRegExp( ext ) + "$" );
} );

export default function( pathname, ext ) {
  assertPath( pathname );
  if ( !pathname ) {
    return "";
  }
  const base = normalizeArr( split( pathname ) ).pop();
  return ext ? base.replace( createReExt( ext ), "" ) : base;
}
