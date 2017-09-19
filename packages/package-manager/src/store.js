// @flow

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

  constructor() {
    this.map = new Map();
  }

  async extract( resolved: string, opts: InstallOptions ) {
    // TODO deal with more options, like integrity
    // Atomic write? Make sure if folder exists, the extraction was not left before completion
    // See https://github.com/npm/npm/blob/latest/lib/config/pacote.js

    const id = buildId( resolved );
    const folder = path.join( opts.store, "modules", id, "files" );
    const exists = await fs.pathExists( folder );

    if ( !exists ) {
      await pacote.extract( resolved, folder, opts );
    }

    return id;
  }

  async linkNodeModules( folder: string, set: ImmutableResolutionSet, opts: InstallOptions, fake: ?boolean ) {
    const promises = [];

    await fs.ensureDir( path.join( folder, "node_modules" ) );

    if ( fake ) {
      set.forEach( res => {
        promises.push(
          this.createResolution( res, opts ).then( async resFolder => {
            const depFolder = path.join( folder, "node_modules", res.data.name );
            const json = {
              name: res.data.name,
              main: resFolder // FIXME because this will only work with index.js
            };

            await fs.outputFile( path.join( depFolder, "package.json" ), JSON.stringify( json, null, 2 ) );
          } )
        );
      } );
    } else {
      set.forEach( res => {
        promises.push(
          this.createResolution( res, opts ).then( resFolder => {
            return symlinkDir( resFolder, path.join( folder, "node_modules", res.data.name ) );
          } )
        );
      } );
    }

    await Promise.all( promises );
  }

  async createResolution( resolution: ImmutableResolution, opts: InstallOptions ): Promise<string> {
    let p = this.map.get( resolution.data.resolved );
    if ( !p ) {
      p = this._createResolution( resolution, opts );
      this.map.set( resolution.data.resolved, p );
    }
    return p;
  }

  async _createResolution( resolution: ImmutableResolution, opts: InstallOptions ): Promise<string> {

    const id = buildId( resolution.data.resolved );
    const filesFolder = path.join( opts.store, "modules", id, "files" );
    const resFolders = path.join( opts.store, "modules", id, "res" );
    const hash = resolution.hashCode();
    let i = 0;

    while ( true ) {

      const uniqueHash = `${hash}-${i}`;
      const res = path.join( resFolders, uniqueHash );
      const resFile = path.join( resFolders, `${uniqueHash}.qpm-res` );

      const currentStr = await read( resFile );

      if ( currentStr === "" ) {

        await fs.emptyDir( res );

        const promises = [
          this.linkNodeModules( res, resolution.set, opts )
        ];

        await new Promise( ( resolve, reject ) => { // eslint-disable-line no-loop-func
          klaw( filesFolder )
            .on( "data", item => {
              if ( item.stats.isFile() ) {
                const relative = path.relative( filesFolder, item.path );
                const dest = path.resolve( res, relative );
                promises.push( fs.ensureLink( item.path, dest ) );
              }
            } )
            .on( "error", reject )
            .on( "end", resolve );
        } );

        await Promise.all( promises );

        await fs.outputFile( resFile, resolution.toString() );

        return res;

      } else if ( currentStr === resolution.toString() ) {

        return res;

      }

      if ( i++ > 50 ) {
        break;
      }
    }

    throw new Error( `Too many collisions?... '${id}'` );
  }

}
