export default function isEmpty( obj: any ) {
  if ( obj ) {
    for ( const name in obj ) {
      return false;
    }
  }
  return true;
}
