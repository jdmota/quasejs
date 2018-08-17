function arrayIncludesWith( array, target, comparator ) {
  for ( const value of array ) {
    if ( comparator( target, value ) ) {
      return true;
    }
  }
  return false;
}

export default function difference( array, values, comparator ) {
  const result = [];

  if ( !array.length ) {
    return result;
  }

  for ( const value of array ) {
    if ( !arrayIncludesWith( values, value, comparator ) ) {
      result.push( value );
    }
  }
  return result;
}
