// @flow

import type { InstallOptions } from "./installer";
import pacoteOptions from "./pacote-options";

const npa = require( "npm-package-arg" );
const pacote = require( "pacote" );
const filenamify = require( "filenamify" );

const reSha = /^sha\d+-/;

// Because of case insensitive OS's
function lowerCaseIntegrity( integrity: string ): string {
  const prefix = ( integrity.match( reSha ) || [ "" ] )[ 0 ];
  return prefix + Buffer.from( integrity.substring( prefix.length ), "base64" ).toString( "hex" );
}

export function buildId( resolved: string, integrity: string ): string {
  return filenamify( resolved ) + "/" + lowerCaseIntegrity( integrity );
}

export default async function( name: string, version: string, opts: InstallOptions ) {

  if ( !name ) {
    throw new Error( "Missing name" );
  }

  if ( !version ) {
    throw new Error( `Missing version for name '${name}'` );
  }

  const spec = npa.resolve( name, version );

  const pkg = await pacote.manifest( spec, pacoteOptions( opts ) );

  if ( pkg.name !== spec.name ) {
    throw new Error( `Name '${name}' does not match the name in the manifest: ${pkg.name} (version: ${pkg.version})` );
  }

  return {
    name: pkg.name,
    version: pkg.version,
    resolved: pkg._resolved,
    integrity: pkg._integrity + "",
    deps: pkg.dependencies
  };
}
