function error( message: string ) {
  const e = new TypeError( message );
  // @ts-ignore
  e.__validation = true;
  return e;
}

export function assertNumber( n: unknown ): n is number {
  if ( typeof n !== "number" ) {
    throw error( "Expected a number but saw " + n );
  }
  return true;
}

export function assertTimeout( n: unknown, text = "timeout" ) {
  if ( assertNumber( n ) ) {
    if ( n > 2 ** 31 ) {
      throw error( `${n} is too big of a ${text} value` );
    }
    if ( n < 0 ) {
      throw error( `${n} is too small of a ${text} value` );
    }
  }
}

export function assertDelay( n: unknown ) {
  if ( assertNumber( n ) ) {
    if ( n > 2 ** 31 ) {
      throw error( `${n} is too big of a delay value` );
    }
    if ( n < 0 ) {
      throw error( `${n} is too small of a delay value` );
    }
  }
}
