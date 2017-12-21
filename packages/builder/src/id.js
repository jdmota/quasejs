// @flow

const path = require( "path" );
const slash = require( "slash" );

opaque type ID = string;

export type { ID };

export function pathToId( id: string ): ID {
  return id;
}

export function idToPath( id: ID ): string {
  return id;
}

export function idToString( id: ID | string, cwd: ID | string ): string {
  return slash( path.relative( cwd, id ) );
}

export function relativeURL( id: ID | string, cwd: ID | string ): string {
  return slash( path.relative( path.dirname( cwd ), id ) );
}

export function resolveId( id: ID | string, cwd: ID | string ): ID {
  return path.resolve( cwd, id );
}

export function resolvePath( id: ID | string, cwd: ID | string ): string {
  return path.resolve( cwd, id );
}

export function getType( id: ID ): string {
  const match = id.match( /\.(.+)$/ );
  return match ? match[ 1 ] : "";
}

export const depsSorter =
  ( { resolved: a }: { +resolved: ID }, { resolved: b }: { +resolved: ID } ) => a.localeCompare( b );

export const modulesSorter =
  ( { id: a }: { +id: ID }, { id: b }: { +id: ID } ) => a.localeCompare( b );
