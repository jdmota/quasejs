// @flow
import type { Name, Version, ResolvedObj, Options } from "./types";
import { toStr } from "./types";
import pacoteOptions from "./pacote-options";

const npa = require( "npm-package-arg" );
const pacote = require( "pacote" );

export default async function( name: Name, version: Version, opts: Options ): Promise<ResolvedObj> {

  if ( !name ) {
    throw new Error( "Missing name" );
  }

  if ( !version ) {
    throw new Error( `Missing version for name '${toStr( name )}'` );
  }

  const spec = npa.resolve( name, version );

  const pkg = await pacote.manifest( spec, pacoteOptions( opts ) );

  if ( pkg.name !== spec.name ) {
    throw new Error( `Name '${toStr( name )}' does not match the name in the manifest: ${pkg.name} (version: ${pkg.version})` );
  }

  return {
    name: pkg.name,
    version: pkg.version,
    resolved: pkg._resolved,
    integrity: pkg._integrity + "",
    deps: pkg.dependencies
  };
}
