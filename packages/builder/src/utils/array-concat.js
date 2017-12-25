// @flow

export default function<T>( array: T[], values: T[] ): T[] {
  const offset = array.length;
  for ( let i = 0; i < values.length; i++ ) {
    array[ offset + i ] = values[ i ];
  }
  return array;
}
