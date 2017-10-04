// @flow

const path = require( "path" );

opaque type ID = string;

export type { ID };

export function pathToId( id: string ): ID {
  return id;
}

export function idToString( id: ID | string, cwd: string ): string {
  return path.relative( cwd, id ).replace( /\\/g, "/" );
}

export function resolveId( id: ID | string, cwd: string ): ID {
  return path.resolve( cwd, id );
}
