// @flow

const path = require( "path" );

opaque type Name = string;
opaque type Version = string;
opaque type ExactVersion = string;
opaque type Resolved = string;
opaque type Integrity = string;

type DepType = "deps" | "devDeps" | "optionalDeps";

type ResolvedObj = {
  name: Name,
  version: ExactVersion,
  savedVersion: Version,
  resolved: Resolved,
  integrity: Integrity,
  deps: { [name: Name]: Version }
};

type PartialResolvedObj = {
  name: Name,
  version: ExactVersion,
  resolved: Resolved,
  integrity: Integrity
};

export type { Name, Version, ExactVersion, Resolved, Integrity, PartialResolvedObj, ResolvedObj, DepType };

export function toStr( str: Name | Version | ExactVersion | Resolved | Integrity ): string {
  return str;
}

export function pathJoin( a: string, b: string, c: Name ) {
  return path.join( a, b, c );
}

export type Options = {
  folder: string,
  store: string,
  cache: string,
  offline: ?boolean,
  preferOffline: ?boolean,
  preferOnline: ?boolean,
  frozenLockfile: boolean,
  production: ?boolean,
  global: boolean,
  type: ?( "prod" | "dev" | "optional" )
};

export type Warning = {
  code: string,
  message: string,
  [key: string]: any
};
