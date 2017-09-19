// @flow

import type { InstallOptions } from "./installer";

const npa = require( "npm-package-arg" );
const pacote = require( "pacote" );
const parseNpmTarballUrl = require( "parse-npm-tarball-url" ).default;
/* const path = require( "path" );
const encodeRegistry = require( "encode-registry" );
const normalize = require( "normalize-path" );

function buildIdNpm( spec, pkg ) {
  return `${encodeRegistry( pkg.dist.tarball )}/${pkg.name}/${pkg.version}`;
}

function buildIdLocal( spec ) {
  return `file:${normalize( path.relative( "prefix", spec.fetchSpec ) )}`;
}*/

export function buildId( resolved: string ): string {
  if ( resolved.startsWith( "http://registry.npmjs.org/" ) || resolved.startsWith( "https://registry.npmjs.org/" ) ) {
    const parsed = parseNpmTarballUrl( resolved );
    if ( parsed ) {
      return `${parsed.host}/${parsed.pkg.name}/${parsed.pkg.version}`;
    }
  }
  throw new Error( `Cannot transform '${resolved}' in an id` );
  // TODO return resolved.replace( /^.*:\/\/(git@)?/, "" ).replace( /\.tgz$/, "" );
}

export default async function( name: string, version: string, opts: InstallOptions ) {

  if ( !name ) {
    throw new Error( "Missing name" );
  }

  if ( !version ) {
    throw new Error( `Missing version for name '${name}'` );
  }

  const spec = npa.resolve( name, version );

  const pkg = await pacote.manifest( spec, opts );

  if ( pkg.name !== spec.name ) {
    throw new Error( `Name '${name}' does not match the name in the manifest: ${pkg.name} (version: ${pkg.version})` );
  }

  return {
    name: pkg.name,
    version: pkg.version,
    resolved: pkg._resolved,
    integrity: pkg._integrity,
    deps: pkg.dependencies
  };
}
