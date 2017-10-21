// @flow

import type { Name, Version, ExactVersion, Resolved, Integrity } from "./types";

const path = require( "path" );
const loadJsonFile = require( "load-json-file" );
const writeJsonFile = require( "write-json-file" );

const file = "qpm-lockfile.json";

const LOCK_VERSION = "1"; // TODO deal with different versions

export type Deps = { [name: Name]: { savedVersion: Version, resolved: Resolved, i: number } };

export type Entry = [Name, ExactVersion, Resolved, Integrity, number[]];

export type Lockfile = {
  v: string,
  resolutions: Entry[],
  deps: Deps,
  devDeps: Deps,
  optionalDeps: Deps,
};

function error( bool: boolean ) {
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

export function shouldReuse( lockfile: Object ): boolean {
  if ( isEmpty( lockfile ) ) {
    return false;
  }
  error( typeof lockfile.v === "string" );
  error( Array.isArray( lockfile.resolutions ) );
  error( isObject( lockfile.deps ) );
  error( isObject( lockfile.devDeps ) );
  error( isObject( lockfile.optionalDeps ) );
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
