import { memoizeStringOnly } from "../../_helper/memoizeStringOnly";
import { isAbs } from "./is-absolute";
import { normalizeArr } from "./normalize";
import { split, assertPath } from "./vars";

export default memoizeStringOnly( function( pathname ) {
  assertPath( pathname );
  const urlIsAbs = isAbs( pathname ) ? "/" : "";
  const urlArr = split( pathname );
  const arr = normalizeArr( urlArr, !urlIsAbs );
  arr.pop();
  return ( urlIsAbs + arr.join( "/" ) ) || ".";
} );
