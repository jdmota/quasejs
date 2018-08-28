// @flow
import { hash, read, readJSON, crawl } from "./utils";
import type { AliasName, Resolved, Integrity, Options, Warning } from "./types";
import { toStr, pathJoin } from "./types";
import pacoteOptions from "./pacote-options";
import linkBins from "./link-bins";
import { read as readPkg } from "./pkg";
import type { Resolution } from "./resolution";
import type { Installer } from "./commands/installer";

const fs = require( "fs-extra" );
const path = require( "path" );
const pacote = require( "pacote" );
const symlinkDir = require( "symlink-dir" );
const homedir = require( "os" ).homedir();

const MAX_COLLISIONS = 10;

const STORE_VERSION = "1";

/*
File system layout:

pkgId = <hash of resolved + integrity>-<index collision>
resolutionId = <hash of resolution set>-<index collision>

Files folder: STORE/VERSION/<pkgId>/files
Package info: STORE/VERSION/<pkgId>/files/.qpm

A resolution set folder: STORE/VERSION/<pkgId>/res/<resolutionId>
Resolution set converted to string: STORE/VERSION/<pkgId>/res/<resolutionId>.qpm-res

STORE/VERSION/<pkgId>/res/<resolutionId>/node_modules/<name> has links to:
- STORE/VERSION/<pkgId>/files [hard link]
- And its dependencies: STORE/VERSION/<depId>/res/<depResolutionId>/node_modules/<depName>

.qpm and .qpm-res files also serve to tell that the job was done

*/

function buildId( resolved: Resolved, integrity: Integrity ): string {
  return hash( `${toStr( resolved )}/${toStr( integrity )}` );
}

export default class Store {

  static DEFAULT = path.resolve( homedir, ".qpm-store" );

  +store: string; // The path includes the version of the store
  +opts: Options;
  +warn: Warning => void;

  constructor( opts: Options, installer: Installer ) {
    this.store = path.resolve( opts.store, STORE_VERSION );
    this.opts = opts;
    this.warn = installer.warn;
  }

  // Make sure package is in the store
  async extract( resolution: Resolution ): Promise<void> {
    await this.extract1( resolution );
    await this.extract2( resolution );
  }

  async extract1( resolution: Resolution ): Promise<void> {

    const { resolved, integrity } = resolution.data;
    const hash = buildId( resolved, integrity );
    let collisionIdx = 0;

    while ( true ) {

      const id = `${hash}-${collisionIdx}`;
      const folder = path.join( this.store, id, "files" );
      const idFile = path.join( folder, ".qpm" );
      const currentID = await readJSON( idFile );

      if ( !currentID.resolved || !currentID.integrity ) {
        // pacote.extract already empties and ensures the folder's existance
        await pacote.extract( resolved, folder, pacoteOptions( this.opts, integrity ) );
        await fs.writeFile( idFile, JSON.stringify( { resolved, integrity } ) );

        resolution.filesFolder = folder;
        return;
      }

      if ( currentID.resolved === resolved && currentID.integrity === integrity ) {

        resolution.filesFolder = folder;
        return;
      }

      if ( collisionIdx++ > MAX_COLLISIONS ) {
        break;
      }

    }

    throw new Error( `Too many collisions?... '${toStr( resolved )}'` );

  }

  async extract2( resolution: Resolution ): Promise<void> {

    const { filesFolder } = resolution;

    if ( !filesFolder ) {
      throw new Error( "Assertion: missing filesFolder" );
    }

    const resFolders = path.resolve( filesFolder, "../res" );
    const hash = resolution.hashCode(); // The hash includes the Resolution format version
    let collisionIdx = 0;

    while ( true ) {

      const uniqueHash = `${hash}-${collisionIdx}`;
      const resFolder = path.join( resFolders, uniqueHash, "node_modules", toStr( resolution.data.name ) );
      const resFile = path.join( resFolders, `${uniqueHash}.qpm-res` );

      const currentStr = await read( resFile );

      if ( currentStr === "" ) {

        // Clean up folder just in case
        await fs.emptyDir( resFolder );

        await crawl( filesFolder, item => {
          if ( item.stats.isFile() ) {
            const relative = path.relative( filesFolder, item.path );
            const dest = path.resolve( resFolder, relative );
            return fs.ensureLink( item.path, dest );
          }
        } );

        await fs.writeFile( resFile, resolution.toString() );

        resolution.resFolder = resFolder;
        return;

      } else if ( currentStr === resolution.toString() ) {

        resolution.resFolder = resFolder;
        return;

      }

      if ( collisionIdx++ > MAX_COLLISIONS ) {
        break;
      }
    }

    throw new Error( `Too many collisions?... '${hash}'` );

  }

  async linkResolutionDeps( resolution: Resolution ): Promise<void> {

    const { filesFolder, resFolder } = resolution;

    if ( !filesFolder ) {
      throw new Error( "Assertion: missing filesFolder" );
    }

    if ( !resFolder ) {
      throw new Error( "Assertion: missing resFolder" );
    }

    const promises = [];

    resolution.forEach( ( alias, depRes ) => {
      promises.push( ( () => {
        if ( alias !== resolution.data.name ) {
          if ( !depRes.resFolder ) {
            throw new Error( "Assertion: missing resFolder in dependency" );
          }
          return symlinkDir( depRes.resFolder, pathJoin( resFolder, "..", alias ) );
        }
      } )() );
    } );

    await Promise.all( promises );
  }

  async removeExcess( folder: string, map: Map<AliasName, Resolution> ) {

    const promises = [];

    for ( const nameStr of await fs.readdir( folder ) ) {
      const name: AliasName = nameStr;

      if ( name !== ".bin" && !map.has( name ) ) {
        promises.push( fs.remove( path.join( folder, nameStr ) ) );
      }
    }

    return Promise.all( promises );
  }

  async ensureNodeModulesFolder( folder: string ): Promise<string> {
    const nodeModulesFolder = path.join( folder, "node_modules" );
    await fs.ensureDir( nodeModulesFolder );
    return nodeModulesFolder;
  }

  async ensureBinsFolder( folder: string ): Promise<string> {
    const binsFolder = path.join( folder, "node_modules", ".bin" );
    await fs.ensureDir( binsFolder );
    return binsFolder;
  }

  async linkOneNodeModule( folder: string, alias: AliasName, res: Resolution, binOpts: Object ) {
    const { resFolder, filesFolder } = res;
    const { binPath, usedCmds } = binOpts;
    const depFolder = pathJoin( folder, "node_modules", alias );

    const p1 = linkBins( {
      pkg: await readPkg( filesFolder, true, true ),
      pkgPath: filesFolder,
      binPath,
      usedCmds,
      warn: this.warn
    } );

    const p2 = symlinkDir( resFolder, depFolder );

    await Promise.all( [ p1, p2 ] );
  }

  async linkNodeModules( folder: string, map: Map<AliasName, Resolution> ) {
    const promises = [];
    const nodeModulesFolder = await this.ensureNodeModulesFolder( folder );

    promises.push( this.removeExcess( nodeModulesFolder, map ) );

    const binOpts = {
      binPath: await this.ensureBinsFolder( folder ),
      usedCmds: {}
    };

    for ( const [ alias, res ] of map ) {
      promises.push( this.linkOneNodeModule( folder, alias, res, binOpts ) );
    }

    await Promise.all( promises );
  }

}
