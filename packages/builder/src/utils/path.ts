const path = require( "path" );
const slash = require( "slash" );

export const reExt = /\.(.+)$/;

export function lowerPath( p: string ) {
  return path.sep === "\\" ? p.toLowerCase() : p;
}

export function relative( id: string, cwd: string ): string {
  return slash( lowerPath( path.relative( cwd, id ) ) );
}

export function relativeURL( id: string, cwd: string ): string {
  return slash( lowerPath( path.relative( path.dirname( cwd ), id ) ) );
}

export function resolvePath( id: string, cwd: string ): string {
  return lowerPath( path.resolve( cwd, id ) );
}

export function getType( id: string ): string {
  const match = id.match( reExt );
  return match ? match[ 1 ] : "";
}

export function makeAbsolute( file: string ) {
  return lowerPath( path.resolve( process.cwd(), file ) );
}

export function isAbsolute( file: string ): boolean {
  return path.isAbsolute( file );
}
