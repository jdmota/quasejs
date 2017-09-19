import { memoizeStringOnly } from "../../_helper/memoizeStringOnly";
import { isAbs } from "./is-absolute";
import { split, assertPath } from "./vars";

export const normalizeArr = function( urlArr, urlNotAbs ) {

  const res = [];

  for ( let i = 0; i < urlArr.length; i++ ) {

    const p = urlArr[ i ];

    if ( !p || p === "." ) {
      continue;
    }

    if ( p === ".." ) {
      if ( res.length && res[ res.length - 1 ] !== ".." ) {
        res.pop();
      } else if ( urlNotAbs ) {
        res.push( ".." );
      }
    } else {
      res.push( p );
    }

  }

  return res;
};

// Assume that `p` is a string
export const normalizePre = memoizeStringOnly( function( pathname ) {
  if ( !pathname ) {
    return ".";
  }
  const urlIsAbs = isAbs( pathname ) ? "/" : "";
  const urlArr = split( pathname );
  return urlIsAbs + normalizeArr( urlArr, !urlIsAbs ).join( "/" );
} );

export default function( pathname ) {
  assertPath( pathname );
  return normalizePre( pathname );
}
