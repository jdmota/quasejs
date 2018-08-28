// @flow
import type { AliasName, ActualName, Spec, ExactVersion, Resolved, Integrity } from "./types";
import { error, isObject } from "./utils";

const path = require( "path" );
const loadJsonFile = require( "load-json-file" );
const writeJsonFile = require( "write-json-file" );
const sortKeys = require( "sort-keys" );

const FILENAME = "qpm-lockfile.json";
const LOCK_VERSION = "1";

export type Deps = {
  [name: AliasName]: {|
    spec: Spec,
    resolved: Resolved,
    i: number
  |}
};

export type Entry = [ActualName, ExactVersion, Resolved, Integrity, { [alias: AliasName]: number }];

export type Lockfile = {|
  v: string,
  resolutions: Entry[],
  deps: Deps,
  devDeps: Deps,
  optionalDeps: Deps,
  __new?: ?boolean
|};

function checkSameVersion( v: string ) {
  if ( LOCK_VERSION !== v ) {
    throw error( `Found a lockfile with version ${v}. Expected it to be ${LOCK_VERSION}` );
  }
}

function invariant( bool: boolean ) {
  if ( !bool ) {
    throw error( "Invalid lockfile." );
  }
}

function validateEntry( entry: Object ): boolean {
  invariant( Array.isArray( entry ) );
  invariant( entry.length === 5 );
  invariant( typeof entry[ 0 ] === "string" );
  invariant( typeof entry[ 1 ] === "string" );
  invariant( typeof entry[ 2 ] === "string" );
  invariant( typeof entry[ 3 ] === "string" );
  invariant( entry[ 4 ] != null && typeof entry[ 4 ] === "object" );
  return true;
}

export function shouldReuse( lockfile: Object ): boolean {
  if ( lockfile.__new ) {
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
    optionalDeps: {},
    __new: true
  };
}

export async function read( folder: string ): Promise<Lockfile> {
  try {
    return await loadJsonFile( path.resolve( folder, FILENAME ) );
  } catch ( e ) {
    if ( e.code === "ENOENT" ) {
      return create();
    }
    throw e;
  }
}

export function write( folder: string, json: Object ): Promise<void> {
  delete json.__new;
  json.deps = sortKeys( json.deps );
  json.devDeps = sortKeys( json.devDeps );
  json.optionalDeps = sortKeys( json.optionalDeps );
  return writeJsonFile( path.resolve( folder, FILENAME ), json );
}
