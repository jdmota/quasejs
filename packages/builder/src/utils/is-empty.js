export default function isEmpty( obj ) {
  for ( const name in obj ) {
    return false;
  }
  return true;
}
