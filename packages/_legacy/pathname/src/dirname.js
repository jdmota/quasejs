import { memoizeStringOnly } from "./memoize-string";
import { normalizeArr } from "./normalize";
import { split, join, assertPath } from "./vars";

export default memoizeStringOnly( function( pathname ) {
  assertPath( pathname );
  const arr = normalizeArr( split( pathname ) );
  const last = arr.pop();
  if ( last === "" && arr.length === 0 ) {
    return "/";
  }
  return join( arr );
} );
