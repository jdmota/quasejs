const crypto = require( "crypto" );

type Data = string | Buffer | Uint8Array;

function h( input: Data ) {
  return crypto.createHash( "md5" ).update( input ).digest( "hex" );
}

export default function( input: Data ) {
  return h( input ).slice( 0, 10 );
}

export function hashName( input: Data, usedIds: Set<string>, len: number ): string {
  const id = h( input );
  while ( usedIds.has( id.substr( 0, len ) ) ) {
    len++;
  }
  return id.substr( 0, len );
}
