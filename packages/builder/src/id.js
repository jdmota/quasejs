// @flow

const path = require( "path" );
const slash = require( "slash" );

export function relative( id: string, cwd: string ): string {
  return slash( path.relative( cwd, id ) );
}

export function relativeURL( id: string, cwd: string ): string {
  return slash( path.relative( path.dirname( cwd ), id ) );
}

export function resolvePath( id: string, cwd: string ): string {
  return path.resolve( cwd, id );
}

export function getType( id: string ): string {
  const match = id.match( /\.(.+)$/ );
  return match ? match[ 1 ] : "";
}
