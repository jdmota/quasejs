export default function( candidates ) {
  return function( arg1, arg2, arg3 ) {
    return candidates.reduce( ( promise, candidate ) => {
      return promise.then( result => {
        return result == null ? Promise.resolve( candidate( arg1, arg2, arg3 ) ) : result;
      } );
    }, Promise.resolve() );
  };
}
