// @flow
import { hash, read, readJSON, crawl } from "./utils";
import type { Name, Resolved, Integrity, PartialResolvedObj, Options, Warning } from "./types";
import { toStr, pathJoin } from "./types";
import pacoteOptions from "./pacote-options";
import linkBins from "./link-bins";
import { read as readPkg } from "./pkg";
import type { ImmutableResolution, ImmutableResolutionSet } from "./resolution";

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

  static DEFAULT = path.resolve( homedir, `.qpm-store/${STORE_VERSION}` );

  +store: string; // The path includes the version of the store
  +opts: Options;
  +warn: Warning => void;

  constructor( opts: Options, warn: Warning => void ) {
    this.store = path.resolve( opts.store, STORE_VERSION );
    this.opts = opts;
    this.warn = warn;
  }

  // Make sure package is in the store
  async extract( { resolved, integrity }: PartialResolvedObj ): Promise<string> {

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
        return folder;
      }

      if ( currentID.resolved === resolved && currentID.integrity === integrity ) {
        return folder;
      }

      if ( collisionIdx++ > MAX_COLLISIONS ) {
        break;
      }

    }

    throw new Error( `Too many collisions?... '${toStr( resolved )}'` );

  }

  async removeExcess( folder: string, set: ImmutableResolutionSet ) {

    const promises = [];

    for ( const nameStr of await fs.readdir( folder ) ) {
      const name: Name = nameStr;

      if ( name !== ".bin" && !set.has( name ) ) {
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

  async linkOneNodeModule( folder: string, res: ImmutableResolution, binOpts: Object ) {
    const { resFolder, filesFolder } = await res.job;
    const { binPath, usedCmds } = binOpts;
    const depFolder = pathJoin( folder, "node_modules", res.data.name );

    const p1 = linkBins( {
      pkg: await readPkg( filesFolder ),
      pkgPath: filesFolder,
      binPath,
      usedCmds,
      warn: this.warn
    } );

    const p2 = symlinkDir( resFolder, depFolder );

    await Promise.all( [ p1, p2 ] );
  }

  async linkNodeModules( folder: string, set: ImmutableResolutionSet ) {
    const promises = [];
    const nodeModulesFolder = await this.ensureNodeModulesFolder( folder );

    promises.push( this.removeExcess( nodeModulesFolder, set ) );

    const binOpts = {
      binPath: await this.ensureBinsFolder( folder ),
      usedCmds: {}
    };

    set.forEach( res => {
      promises.push( this.linkOneNodeModule( folder, res, binOpts ) );
    } );

    await Promise.all( promises );
  }

  async createResolution( filesFolder: string, resolution: ImmutableResolution ): Promise<{ filesFolder: string, resFolder: string }> {

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

        const promises = [];

        promises.push( crawl( filesFolder, item => {
          if ( item.stats.isFile() ) {
            const relative = path.relative( filesFolder, item.path );
            const dest = path.resolve( resFolder, relative );
            return fs.ensureLink( item.path, dest );
          }
        } ) );

        resolution.set.forEach( depRes => {
          promises.push( ( async() => {
            if ( resolution.data.name !== depRes.data.name ) {
              const { resFolder: depResFolder } = await depRes.job;
              return symlinkDir( depResFolder, pathJoin( resFolder, "..", depRes.data.name ) );
            }
          } )() );
        } );

        await Promise.all( promises );

        await fs.writeFile( resFile, resolution.toString() );

        return {
          filesFolder,
          resFolder
        };

      } else if ( currentStr === resolution.toString() ) {

        return {
          filesFolder,
          resFolder
        };

      }

      if ( collisionIdx++ > MAX_COLLISIONS ) {
        break;
      }
    }

    throw new Error( `Too many collisions?... '${hash}'` );
  }

}
