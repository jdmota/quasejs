const crypto = require( "crypto" );

export default function( input ) {
  return crypto.createHash( "md5" ).update( input ).digest( "hex" ).slice( 0, 10 );
}
