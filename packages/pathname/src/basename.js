import { memoizeStringOnly } from "../../_helper/memoizeStringOnly";
import escapeRegExp from "../../_helper/escapeRegExp";
import { isAbs } from "./is-absolute";
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
  const urlIsAbs = isAbs( pathname ) ? "/" : "";
  const urlArr = split( pathname );
  const arr = normalizeArr( urlArr, !urlIsAbs );
  const base = arr.pop();
  return ext ? base.replace( createReExt( ext ), "" ) : base;
}
