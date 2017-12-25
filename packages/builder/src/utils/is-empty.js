// @flow

export default function isEmpty( obj: Object ): boolean {
  for ( const name in obj ) {
    return false;
  }
  return true;
}
