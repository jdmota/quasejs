export default function isEmpty( obj: any ): boolean {
  if ( obj ) {
    for ( const _name in obj ) {
      return false;
    }
  }
  return true;
}
