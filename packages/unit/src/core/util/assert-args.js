export function assertNumber( n ) {
  if ( typeof n !== "number" ) {
    throw new TypeError( "Expected a number but saw " + n );
  }
}

export function assertTimeout( n ) {
  assertNumber( n );
  if ( n > 2 ** 31 ) {
    throw new Error( `${n} is too big of a timeout value` );
  }
  if ( n < 0 ) {
    throw new Error( `${n} is too small of a timeout value` );
  }
}

export function assertDelay( n ) {
  assertNumber( n );
  if ( n > 2 ** 31 ) {
    throw new Error( `${n} is too big of a delay value` );
  }
  if ( n < 0 ) {
    throw new Error( `${n} is too small of a delay value` );
  }
}
