// @flow
const crypto = require( "crypto" );

function h( input ) {
  return crypto.createHash( "md5" ).update( input ).digest( "hex" );
}

export default function( input: string | Buffer ) {
  return h( input ).slice( 0, 10 );
}

export function hashName( name: string, idHashes: Set<string> ): string {
  const origHash = h( name ).slice( 0, 5 );
  let hash = origHash;
  let i = 1;
  while ( idHashes.has( hash ) ) {
    hash = origHash + i++;
  }
  idHashes.add( hash );
  return hash;
}
