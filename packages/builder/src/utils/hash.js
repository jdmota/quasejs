// @flow
const crypto = require( "crypto" );

function h( input ) {
  // $FlowIgnore
  return crypto.createHash( "md5" ).update( input ).digest( "hex" );
}

export default function( input: string | Buffer | Uint8Array ) {
  return h( input ).slice( 0, 10 );
}

export function hashName( input: string | Buffer | Uint8Array, usedIds: Set<string>, len: number ): string {
  const id = h( input );
  while ( usedIds.has( id.substr( 0, len ) ) ) {
    len++;
  }
  return id.substr( 0, len );
}
