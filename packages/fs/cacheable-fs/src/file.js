// @flow
const fs = require( "fs-extra" );

export default class File {

  +location: string;
  _stat: any;
  _read: any;
  _readdir: any;

  constructor( location: string ) {
    this.location = location;
    this._stat = null;
    this._read = null;
    this._readdir = null;
  }

  async stat() {
    return this._stat || ( this._stat = fs.stat( this.location ) );
  }

  async readFile( encoding: ?string ) {
    const read = this._read || ( this._read = fs.readFile( this.location, encoding ) );
    const buffer = await read;
    return encoding ? buffer.toString( encoding ) : buffer;
  }

  async readdir() {
    return this._readdir || ( this._readdir = fs.readdir( this.location ) );
  }

  purgeContent() {
    this._read = null;
    this._readdir = null;
  }

}
