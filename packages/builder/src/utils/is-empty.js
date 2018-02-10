// @flow
export default function isEmpty( obj: ?Object ): boolean {
  if ( obj ) {
    for ( const name in obj ) {
      return false;
    }
  }
  return true;
}
