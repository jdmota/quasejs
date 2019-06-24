import { memoizeStringOnly } from "./memoize-string";
import { split, join, assertPath } from "./vars";

export const normalizeArr = function( urlArr ) {

  const res = [];
  const len = urlArr.length;

  if ( len ) {

    const isAbs = urlArr[ 0 ] === "";

    for ( let i = 0; i < len; i++ ) {

      const p = urlArr[ i ];

      if ( !p || p === "." ) {
        continue;
      }

      if ( p === ".." ) {
        if ( res.length && res[ res.length - 1 ] !== ".." ) {
          res.pop();
        } else if ( !isAbs ) {
          res.push( ".." );
        }
      } else {
        res.push( p );
      }

    }

    if ( isAbs ) {
      res.unshift( "" );
    }

  }

  return res;
};

// Assume that `p` is a string
export const normalizePre = memoizeStringOnly( function( pathname ) {
  if ( !pathname ) {
    return ".";
  }
  return join( normalizeArr( split( pathname ) ) );
} );

export default function( pathname ) {
  assertPath( pathname );
  return normalizePre( pathname );
}
