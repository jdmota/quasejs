import { normalizeArr } from "./normalize";
import { split, join, assertPath } from "./vars";

export function relativeHelper( fromPath, toPath ) {
  assertPath( fromPath );
  assertPath( toPath );

  const fromParts = normalizeArr( split( fromPath ) );
  const toParts = normalizeArr( split( toPath ) );

  const length = Math.min( fromParts.length, toParts.length );
  let samePartsLength = length;
  for ( let i = 0; i < length; i++ ) {
    if ( fromParts[ i ] !== toParts[ i ] ) {
      samePartsLength = i;
      break;
    }
  }

  const outputParts = [];
  for ( let i = samePartsLength; i < fromParts.length; i++ ) {
    outputParts.push( ".." );
  }

  return outputParts.concat( toParts.slice( samePartsLength ) );
}

export default function( fromPath, toPath ) {
  return join( relativeHelper( fromPath, toPath ) );
}
