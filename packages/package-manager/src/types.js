// @flow

const path = require( "path" );

opaque type AliasName = string;
opaque type ActualName = string;
opaque type Spec = string;
opaque type ExactVersion = string;
opaque type RangeVersion = string;
opaque type Resolved = string;
opaque type Integrity = string;

export type DepType = "deps" | "devDeps" | "optionalDeps";

export type PartialResolvedObj = {
  name: ActualName,
  version: ExactVersion,
  resolved: Resolved,
  integrity: Integrity
};

export type ResolvedObj = PartialResolvedObj & {
  deps: { [name: AliasName]: Spec }
};

export type {
  AliasName, ActualName, Spec, ExactVersion, RangeVersion, Resolved, Integrity
};

export function toStr(
  str: AliasName | ActualName | Spec | ExactVersion | RangeVersion | Resolved | Integrity
): string {
  return str;
}

export function pathJoin( a: string, b: string, c: AliasName ) {
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
