function error( message ) {
  const e = new TypeError( message );
  e.__validation = true;
  return e;
}

export function assertNumber( n ) {
  if ( typeof n !== "number" ) {
    throw error( "Expected a number but saw " + n );
  }
}

export function assertTimeout( n ) {
  assertNumber( n );
  if ( n > 2 ** 31 ) {
    throw error( `${n} is too big of a timeout value` );
  }
  if ( n < 0 ) {
    throw error( `${n} is too small of a timeout value` );
  }
}

export function assertDelay( n ) {
  assertNumber( n );
  if ( n > 2 ** 31 ) {
    throw error( `${n} is too big of a delay value` );
  }
  if ( n < 0 ) {
    throw error( `${n} is too small of a delay value` );
  }
}
