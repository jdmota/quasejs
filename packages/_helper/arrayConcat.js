export default function( array, values ) {
  const offset = array.length;
  for ( let i = 0; i < values.length; i++ ) {
    array[ offset + i ] = values[ i ];
  }
  return array;
}
