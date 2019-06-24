// @flow

const pathUrl = require( "@quase/path-url" );
const path = require( "path" );

export function dirname( p: string ): string {
  return pathUrl.lowerPath( path.dirname( p ) );
}

export function makeAbsolutePath( p: string ): string {
  return pathUrl.lowerPath( pathUrl.makeAbsolutePath( p ) );
}
