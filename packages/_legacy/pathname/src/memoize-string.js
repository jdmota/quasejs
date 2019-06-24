const STR_CACHE_MAX_SIZE = 255;

// Memoizes the return value of a function that accepts one string argument
export function memoizeStringOnly( callback, minStrLen ) {

  let cache = {};
  let cacheSize = 0;

  return function( string ) {

    if ( minStrLen === undefined || string.length > minStrLen ) {

      if ( cache[ string ] === undefined ) {

        if ( cacheSize === STR_CACHE_MAX_SIZE ) {
          cache = {};
          cacheSize = 0;
        }

        cache[ string ] = callback( string );
        cacheSize++;

      }

      return cache[ string ];

    }

    return callback( string );

  };

}
