import { normalizeArr } from "./normalize";
import { split, assertPath } from "./vars";

export default function( fromPath, toPath ) {

  assertPath( fromPath );
  assertPath( toPath );

  let fromParts, toParts, length, samePartsLength, outputParts;

  fromParts = normalizeArr( split( fromPath ), true );
  toParts = normalizeArr( split( toPath ), true );

  length = Math.min( fromParts.length, toParts.length );
  samePartsLength = length;
  for ( let i = 0; i < length; i++ ) {
    if ( fromParts[ i ] !== toParts[ i ] ) {
      samePartsLength = i;
      break;
    }
  }

  outputParts = [];
  for ( let i = samePartsLength; i < fromParts.length; i++ ) {
    outputParts.push( ".." );
  }

  outputParts = outputParts.concat( toParts.slice( samePartsLength ) );

  return outputParts.join( "/" );

}
