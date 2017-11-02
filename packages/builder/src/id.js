// @flow

const path = require( "path" );

opaque type ID = string;

export type { ID };

export function pathToId( id: string ): ID {
  return id;
}

export function idToPath( id: ID ): string {
  return id;
}

export function idToString( id: ID | string, cwd: ID | string ): string {
  return path.relative( cwd, id ).replace( /\\/g, "/" );
}

export function resolveId( id: ID | string, cwd: ID | string ): ID {
  return path.resolve( cwd, id );
}

export function getType( id: ID ): string {
  const match = id.match( /\.(.+)$/ );
  return match ? match[ 1 ] : "";
}
