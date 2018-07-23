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

STORE/VERSION/<pkgId>/res/<resolutionId>/<...> === STORE/VERSION/<pkgId>/files/<...> [hard link]
STORE/VERSION/<pkgId>/res/<resolutionId>/node_modules has symlinks

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

    let collisionIdx = 0;

    while ( true ) {

      const id = `${buildId( resolved, integrity )}-${collisionIdx}`;
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

  async linkOneNodeModule( folder: string, res: ImmutableResolution, binOpts: ?Object ) {
    const resFolder = await res.job;

    if ( binOpts ) {
      const filesFolder = path.resolve( resFolder, "../../files" );
      const depFolder = pathJoin( folder, "node_modules", res.data.name );
      const { binPath, usedCmds } = binOpts;

      await linkBins( {
        pkg: await readPkg( filesFolder ),
        pkgPath: filesFolder,
        binPath,
        usedCmds,
        warn: this.warn
      } );

      await crawl( filesFolder, item => {
        if ( item.stats.isFile() ) {
          const relative = path.relative( filesFolder, item.path );
          const dest = path.resolve( depFolder, relative );
          return (
            /\.js$/.test( dest ) ?
              fs.outputFile( dest, `module.exports=require(${JSON.stringify( path.join( resFolder, relative ) )});` ) :
              fs.copy( item.path, dest )
          );
        }
      } );
    } else {
      await symlinkDir( resFolder, pathJoin( folder, "node_modules", res.data.name ) );
    }
  }

  async linkNodeModules( folder: string, set: ImmutableResolutionSet, fake: ?boolean ) {
    const promises = [];
    const nodeModulesFolder = await this.ensureNodeModulesFolder( folder );
    let binOpts;

    if ( fake ) {
      promises.push( this.removeExcess( nodeModulesFolder, set ) );
      binOpts = {
        binPath: await this.ensureBinsFolder( folder ),
        usedCmds: {}
      };
    }

    set.forEach( res => {
      promises.push( this.linkOneNodeModule( folder, res, binOpts ) );
    } );

    await Promise.all( promises );
  }

  async createResolution( filesFolder: string, resolution: ImmutableResolution ): Promise<string> {

    const resFolders = path.resolve( filesFolder, "../res" );
    const hash = resolution.hashCode(); // The hash includes the Resolution format version
    let collisionIdx = 0;

    while ( true ) {

      const uniqueHash = `${hash}-${collisionIdx}`;
      const res = path.join( resFolders, uniqueHash );
      const resFile = path.join( resFolders, `${uniqueHash}.qpm-res` );

      const currentStr = await read( resFile );

      if ( currentStr === "" ) {

        // Clean up folder just in case
        await fs.emptyDir( res );

        const linking = this.linkNodeModules( res, resolution.set );

        await crawl( filesFolder, item => {
          if ( item.stats.isFile() ) {
            const relative = path.relative( filesFolder, item.path );
            const dest = path.resolve( res, relative );
            return fs.ensureLink( item.path, dest );
          }
        } );

        await linking;

        await fs.writeFile( resFile, resolution.toString() );

        return res;

      } else if ( currentStr === resolution.toString() ) {

        return res;

      }

      if ( collisionIdx++ > MAX_COLLISIONS ) {
        break;
      }
    }

    throw new Error( `Too many collisions?... '${hash}'` );
  }

}
