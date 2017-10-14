// @flow

import pacoteOptions from "./pacote-options";
import { buildId } from "./resolve";
import type { InstallOptions } from "./installer";
import type { ImmutableResolution, ImmutableResolutionSet } from "./resolution";

const fs = require( "fs-extra" );
const path = require( "path" );
const pacote = require( "pacote" );
const klaw = require( "klaw" );
const symlinkDir = require( "symlink-dir" );
const homedir = require( "os" ).homedir();

const STORE_VERSION = "1";

/*
File system layout:

Files folder: STORE/modules/<id>/files
A resolution set folder: STORE/modules/<id>/res/<hash of resolution set>-<index collision>
Resolution set converted to string: STORE/modules/<id>/res/<hash of resolution set>-<index collision>.qpm-res

STORE/modules/<id>/res/<hash of resolution set>-<index collision>/<...> === STORE/modules/<id>/files/<...> [hard link]
STORE/modules/<id>/res/<hash of resolution set>-<index collision>/node_modules

.qpm-integrity and .qpm-res files also serve too tell that the job was done

*/

async function read( p ) {
  try {
    return await fs.readFile( p, "utf8" );
  } catch ( e ) {
    if ( e.code === "ENOENT" ) {
      return "";
    }
    throw e;
  }
}

/* eslint no-await-in-loop: 0 */

export default class Store {

  static DEFAULT = path.resolve( homedir, `.qpm-store/${STORE_VERSION}` );

  map: Map<string, Promise<string>>;
  store: string;

  constructor( store: string ) {
    this.map = new Map();
    this.store = path.resolve( store, STORE_VERSION );
  }

  async extract( resolved: string, opts: InstallOptions, integrity: string ) {
    const id = buildId( resolved, integrity );
    const folder = path.join( this.store, id, "files" );
    const integrityFile = path.join( folder, ".qpm-integrity" );
    const currentIntegrity = await read( integrityFile );

    if ( !currentIntegrity || currentIntegrity !== integrity ) {
      await fs.emptyDir( folder );
      await pacote.extract( resolved, folder, pacoteOptions( opts, integrity ) );
      await fs.writeFile( integrityFile, integrity );
    }

    return id;
  }

  async crawl( folder: string, mapper: Function ): Promise<any> {
    const promises = [];
    await new Promise( ( resolve, reject ) => {
      klaw( folder )
        .on( "data", item => {
          const p = mapper( item );
          if ( p ) {
            promises.push( p );
          }
        } )
        .on( "error", reject )
        .on( "end", resolve );
    } );
    return Promise.all( promises );
  }

  async linkNodeModules( folder: string, set: ImmutableResolutionSet, fake: ?boolean ) {
    const promises = [];

    await fs.ensureDir( path.join( folder, "node_modules" ) );

    if ( fake ) {
      set.forEach( res => {
        promises.push(
          this.createResolution( res ).then( async resFolder => {
            const filesFolder = path.join( path.dirname( path.dirname( resFolder ) ), "files" );
            const depFolder = path.join( folder, "node_modules", res.data.name );

            await this.crawl( filesFolder, item => {
              if ( item.stats.isFile() ) {
                const relative = path.relative( filesFolder, item.path );
                const dest = path.resolve( depFolder, relative );
                return (
                  /\.js$/.test( dest ) || !/\..+$/.test( dest ) ?
                    fs.outputFile( dest, `module.exports=require(${JSON.stringify( path.join( resFolder, relative ) )});` ) :
                    fs.copy( item.path, dest )
                );
              }
            } );
          } )
        );
      } );
    } else {
      set.forEach( res => {
        promises.push(
          this.createResolution( res ).then( resFolder => {
            return symlinkDir( resFolder, path.join( folder, "node_modules", res.data.name ) );
          } )
        );
      } );
    }

    await Promise.all( promises );
  }

  async createResolution( resolution: ImmutableResolution ): Promise<string> {
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
    const hash = resolution.hashCode();
    let i = 0;

    while ( true ) {

      const uniqueHash = `${hash}-${i}`;
      const res = path.join( resFolders, uniqueHash );
      const resFile = path.join( resFolders, `${uniqueHash}.qpm-res` );

      const currentStr = await read( resFile );

      if ( currentStr === "" ) {

        await fs.emptyDir( res );

        const linking = this.linkNodeModules( res, resolution.set );

        await this.crawl( filesFolder, item => {
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

      if ( i++ > 20 ) {
        break;
      }
    }

    throw new Error( `Too many collisions?... '${id}'` );
  }

}
