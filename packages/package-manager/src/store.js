// @flow
import { read, crawl } from "./utils";
import type { Name, Resolved, Integrity, Options } from "./types";
import { pathJoin } from "./types";
import pacoteOptions from "./pacote-options";
import { buildId } from "./resolve";
import type { ImmutableResolution, ImmutableResolutionSet } from "./resolution";

const fs = require( "fs-extra" );
const path = require( "path" );
const pacote = require( "pacote" );
const symlinkDir = require( "symlink-dir" );
const homedir = require( "os" ).homedir();

const STORE_VERSION = "1";

/*
File system layout:

Files folder: STORE/VERSION/<id>/files

A resolution set folder: STORE/VERSION/<id>/res/<hash of resolution set>-<index collision>
Resolution set converted to string: STORE/modules/<id>/res/<hash of resolution set>-<index collision>.qpm-res

STORE/VERSION/<id>/res/<hash of resolution set>-<index collision>/<...> === STORE/VERSION/<id>/files/<...> [hard link]
STORE/VERSION/<id>/res/<hash of resolution set>-<index collision>/node_modules has symlinks

.qpm-integrity and .qpm-res files also serve to tell that the job was done

*/

export default class Store {

  static DEFAULT = path.resolve( homedir, `.qpm-store/${STORE_VERSION}` );

  +map: Map<Resolved, Promise<string>>;
  +store: string; // The path includes the version of the store

  constructor( store: string ) {
    this.map = new Map();
    this.store = path.resolve( store, STORE_VERSION );
  }

  // Make sure package is in the store
  async extract( resolved: Resolved, opts: Options, integrity: Integrity ) {
    const id = buildId( resolved, integrity );
    const folder = path.join( this.store, id, "files" );
    const integrityFile = path.join( folder, ".qpm-integrity" );
    const currentIntegrity = await read( integrityFile );

    if ( !currentIntegrity || currentIntegrity !== integrity ) {
      // Clean up folder just in case
      await fs.emptyDir( folder );
      await pacote.extract( resolved, folder, pacoteOptions( opts, integrity ) );
      await fs.writeFile( integrityFile, integrity );
    }

    return id;
  }

  async removeExcess( folder: string, set: ImmutableResolutionSet ) {

    const promises = [];

    for ( const nameStr of await fs.readdir( folder ) ) {
      const name: Name = nameStr;

      if ( !set.has( name ) ) {
        promises.push( fs.remove( path.join( folder, nameStr ) ) );
      }
    }

    return Promise.all( promises );
  }

  async linkNodeModules( folder: string, set: ImmutableResolutionSet, fake: ?boolean ) {
    const promises = [];
    const nodeModulesFolder = path.join( folder, "node_modules" );

    await fs.ensureDir( nodeModulesFolder );

    if ( fake ) {
      set.forEach( res => {
        promises.push(
          this.createResolution( res ).then( async resFolder => {
            const filesFolder = path.join( path.dirname( path.dirname( resFolder ) ), "files" );
            const depFolder = pathJoin( folder, "node_modules", res.data.name );

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
          } )
        );
      } );

      promises.push( this.removeExcess( nodeModulesFolder, set ) );

    } else {
      set.forEach( res => {
        promises.push(
          this.createResolution( res ).then( resFolder => {
            return symlinkDir( resFolder, pathJoin( folder, "node_modules", res.data.name ) );
          } )
        );
      } );
    }

    await Promise.all( promises );
  }

  createResolution( resolution: ImmutableResolution ): Promise<string> {
    let p = this.map.get( resolution.data.resolved );
    if ( !p ) {
      p = this._createResolution( resolution );
      this.map.set( resolution.data.resolved, p );
    }
    return p;
  }

  async _createResolution( resolution: ImmutableResolution ): Promise<string> {

    const id = buildId( resolution.data.resolved, resolution.data.integrity );
    const filesFolder = path.join( this.store, id, "files" );
    const resFolders = path.join( this.store, id, "res" );
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

      if ( collisionIdx++ > 20 ) {
        break;
      }
    }

    throw new Error( `Too many collisions?... '${id}'` );
  }

}
