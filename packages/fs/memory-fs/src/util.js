const pathUrl = require( "@quase/path-url" );
const path = require( "path" );

function lower( p ) {
  return path.sep === "\\" ? p.toLowerCase() : p;
}

export function dirname( p ) {
  return lower( path.dirname( p ) );
}

export function makeAbsolute( p ) {
  return pathUrl.isUrl( p ) ? pathUrl.makeAbsoluteUrl( p ) : makeAbsolutePath( p );
}

export function makeAbsolutePath( p ) {
  return lower( pathUrl.makeAbsolutePath( p ) );
}

export function makeAbsoluteUrl( p ) {
  return pathUrl.makeAbsoluteUrl( p );
}

export const isUrl = pathUrl.isUrl;
