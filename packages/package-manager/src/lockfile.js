// @flow

import type { Name, Version, ExactVersion, Resolved, Integrity } from "./types";

const path = require( "path" );
const loadJsonFile = require( "load-json-file" );
const writeJsonFile = require( "write-json-file" );

const file = "qpm-lockfile.json";

const LOCK_VERSION = "1";

export type Deps = { [name: Name]: { savedVersion: Version, resolved: Resolved, i: number } };

export type Entry = [Name, ExactVersion, Resolved, Integrity, number[]];

export type Lockfile = {
  v: string,
  resolutions: Entry[],
  deps: Deps,
  devDeps: Deps,
  optionalDeps: Deps,
};

function checkSameVersion( v: string ) {
  if ( LOCK_VERSION !== v ) {
    throw new Error( `Found a lock file with version ${v}. Expected it to be ${LOCK_VERSION}` );
  }
}

function invariant( bool: boolean ) {
  if ( !bool ) {
    throw new Error( "Invalid lockfile." );
  }
}

function isObject( obj: any ): boolean {
  return obj != null && typeof obj === "object";
}

function isEmpty( obj: Object ) {
  for ( const key in obj ) {
    return false;
  }
  return true;
}

function validateEntry( entry: Object ): boolean {
  invariant( Array.isArray( entry ) );
  invariant( entry.length === 5 );
  invariant( typeof entry[ 0 ] === "string" );
  invariant( typeof entry[ 1 ] === "string" );
  invariant( typeof entry[ 2 ] === "string" );
  invariant( typeof entry[ 3 ] === "string" );
  invariant( Array.isArray( entry[ 4 ] ) );
  return true;
}

export function shouldReuse( lockfile: Object ): boolean {
  if ( isEmpty( lockfile ) ) {
    return false;
  }
  invariant( typeof lockfile.v === "string" );
  checkSameVersion( lockfile.v );
  invariant( isObject( lockfile.deps ) );
  invariant( isObject( lockfile.devDeps ) );
  invariant( isObject( lockfile.optionalDeps ) );
  invariant( Array.isArray( lockfile.resolutions ) );
  invariant( lockfile.resolutions.length === 0 || validateEntry( lockfile.resolutions[ 0 ] ) );
  return true;
}

export function create(): Lockfile {
  return {
    v: LOCK_VERSION,
    resolutions: [],
    deps: {},
    devDeps: {},
    optionalDeps: {}
  };
}

export async function read( folder: string ): Promise<Object> {
  try {
    return await loadJsonFile( path.resolve( folder, file ) );
  } catch ( e ) {
    if ( e.code === "ENOENT" ) {
      return {};
    }
    throw e;
  }
}

export async function write( folder: string, json: Object ) {
  return writeJsonFile( path.resolve( folder, file ), json );
}
