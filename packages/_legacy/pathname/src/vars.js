export const SLASH_CODE = 47; // "/"
export const BACK_SLASH_CODE = 92; // "\\"

export function assertPath( path ) {
  if ( typeof path !== "string" ) {
    throw new TypeError( "Path must be a string." );
  }
}

const SEP = /[\\/]/;

export function split( path ) {
  return path ? path.split( SEP ) : [];
}

export function join( arr ) {
  if ( arr.length === 1 ) {
    return arr[ 0 ] || "/";
  }
  return arr.join( "/" ) || ".";
}
