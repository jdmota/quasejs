import { makeAbsolutePath, cacheableJob } from "./util";

const fs = require( "fs-extra" );

export default class FsFile {

  constructor( location ) {
    this.location = makeAbsolutePath( location );
    this._stat = cacheableJob( fs.stat, fs.statSync );
    this._read = cacheableJob( fs.readFile, fs.readFileSync );
    this._readdir = cacheableJob( fs.readdir, fs.readdirSync );
  }

  async stat() {
    return this._stat.async( this.location );
  }

  async readFile( encoding ) {
    const buffer = await this._read.async( this.location, encoding );
    return encoding ? buffer.toString( encoding ) : buffer;
  }

  async readdir() {
    return this._readdir.async( this.location );
  }

  statSync() {
    return this._stat.sync( this.location );
  }

  readFileSync( encoding ) {
    const buffer = this._read.sync( this.location, encoding );
    return encoding ? buffer.toString( encoding ) : buffer;
  }

  readdirSync() {
    return this._readdir.sync( this.location );
  }

}
