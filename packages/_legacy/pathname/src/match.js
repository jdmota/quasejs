import { assertPath } from "./vars";

const nativeDecodeParam = decodeURIComponent;

export default function( path, pattern ) {

  assertPath( path );

  let result = null;
  let names = pattern.names;
  let match = path.match( pattern.regexp );

  if ( pattern.negated ) {
    return match ? null : {};
  }

  if ( match ) {
    result = {};
    for ( let i = 0; i < names.length; i++ ) {
      result[ names[ i ] ] = match[ i + 1 ] ? nativeDecodeParam( match[ i + 1 ] ) : match[ i + 1 ];
    }
  }

  return result;
}
