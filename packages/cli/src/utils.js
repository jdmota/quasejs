export function isObject( x ) {
  return x != null && typeof x === "object";
}

export function arrify( val ) {
  if ( val == null ) {
    return [];
  }
  return Array.isArray( val ) ? val : [ val ];
}

export function pad( str, length ) {
  while ( str.length < length ) {
    str += " ";
  }
  return str;
}
