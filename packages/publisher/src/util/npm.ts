import * as versionUtil from "./version";
import { Pkg } from "../types";
import { error, execStdout } from "./util";

const execa = require( "execa" );
const pTimeout = require( "p-timeout" );

export const checkConnection = () => pTimeout(
  ( async() => {
    try {
      await execa( "npm", [ "ping" ] );
      return true;
    } catch ( _ ) {
      throw error( "Connection to npm registry failed" );
    }
  } )(),
  15000,
  "Connection to npm registry timed out"
);

export const username = async( { externalRegistry }: { externalRegistry: string | false } ) => {
  const args = [ "whoami" ];
  if ( externalRegistry ) {
    args.push( "--registry", externalRegistry );
  }
  try {
    return await execa.stdout( "npm", args );
  } catch ( error ) {
    throw error( /ENEEDAUTH/.test( error.stderr ) ?
      "You must be logged in. Use `npm login` and try again." :
      "Authentication error. Use `npm whoami` to troubleshoot." );
  }
};

export const collaborators = async( packageName: string ) => {
  try {
    return await execa.stdout( "npm", [ "access", "ls-collaborators", packageName ] );
  } catch ( error ) {
    // Ignore non-existing package error
    if ( error.stderr.includes( "code E404" ) ) {
      return false;
    }
    error.__generated = true;
    throw error;
  }
};

export const prereleaseTags = async( packageName: string ) => {

  let tags: string[] = [];
  try {
    const { stdout } = await execa( "npm", [ "view", "--json", packageName, "dist-tags" ] );
    tags = Object.keys( JSON.parse( stdout ) ).filter( tag => tag !== "latest" );
  } catch ( error ) {
    if ( ( ( JSON.parse( error.stdout ) || {} ).error || {} ).code !== "E404" ) {
      error.__generated = true;
      throw error;
    }
  }

  if ( tags.length === 0 ) {
    tags.push( "next" );
  }

  return tags;
};

export const isExternalRegistry = ( pkg: Pkg ): pkg is Pkg & { publishConfig: { registry: string } } => {
  return typeof pkg.publishConfig === "object" && typeof pkg.publishConfig.registry === "string";
};

export const version = () => execStdout( "npm", [ "--version" ] );

export const verifyRecentNpmVersion = async() => {
  const npmVersion = await version();

  if ( versionUtil.satisfies( npmVersion, "<6.8.0" ) ) {
    throw error( "Please upgrade to npm@6.8.0 or newer" );
  }
};
