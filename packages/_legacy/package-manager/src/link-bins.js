// @flow
import type { Warning } from "./types";
import { readdir } from "./utils";

const cmdShim = require( "@zkochan/cmd-shim" );
const fs = require( "fs-extra" );
const path = require( "path" );
// const Module = require( "module" );

type BinWarning = Warning & {
  pkgPath: string,
  commandName: string,
  commandPath: string
};

type Arg = {
  pkg: Object,
  pkgPath: string,
  binPath: string,
  warn: BinWarning => void,
  usedCmds: { [key: string]: string }
};

/* async function getBinNodePaths( target: string ) {
  const targetRealPath = await fs.realpath( target );

  return Module._nodeModulePaths( targetRealPath ).concat(
    Module._nodeModulePaths( target )
  );
} */

async function linkBin( commandName: string, commandPath: string, { pkg, pkgPath, binPath, warn, usedCmds }: Arg ) {
  if ( await fs.pathExists( commandPath ) ) {

    if ( usedCmds[ commandName ] ) {
      warn( {
        code: "DuplicateBin",
        message: `Cannot link bin "${commandName}" of "${pkg.name}" to "${binPath}". A package called "${usedCmds[ commandName ]}" already has its bin linked.`,
        pkg,
        pkgPath,
        commandName,
        commandPath
      } );
      return;
    }
    usedCmds[ commandName ] = pkg.name;

    const externalBinPath = path.join( binPath, commandName );
    // const nodePath = ( await getBinNodePaths( commandPath ) ).join( path.delimiter );

    return cmdShim( commandPath, externalBinPath, {
      // TODO https://github.com/pnpm/cmd-shim/issues/3
      // nodePath
    } );
  }
  warn( {
    code: "BinNotFound",
    message: `Could not find file for command ${commandName} defined in package ${pkg.name}@${pkg.version}`,
    pkg,
    pkgPath,
    commandName,
    commandPath
  } );
}

// Assuming package.json is already normalized
// Assuming binPath already exists
export default async function linkBins( arg: Arg ) {

  const { pkg, pkgPath } = arg;
  const promises = [];

  if ( pkg.bin ) {
    for ( const name of Object.keys( pkg.bin ) ) {
      promises.push(
        linkBin( name, path.join( pkgPath, pkg.bin[ name ] ), arg )
      );
    }
  } else if ( pkg.directories && pkg.directories.bin ) {
    const binDir = path.join( pkgPath, pkg.directories.bin );
    const files = await readdir( binDir );

    for ( const file of files ) {
      promises.push(
        linkBin( file, path.join( binDir, file ), arg )
      );
    }
  }

  await Promise.all( promises );
}
