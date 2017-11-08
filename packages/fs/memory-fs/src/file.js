const fetch = typeof window !== "undefined" && window.fetch; // eslint-disable-line no-undef
const fs = !fetch && require( "fs-extra" );
const { makeAbsolute } = require( "@quase/path-url" );

class FsFile {

  constructor( location ) {
    this.location = makeAbsolute( location );
    this._isFile = null;
    this._isDir = null;
    this._readP = null;
    this._statP = null;
  }

  fromFS() {
    return true;
  }

  fromWeb() {
    return false;
  }

  _read() {
    return this._readP || ( this._readP = fs.readFile( this.location ) );
  }

  _stat() {
    return this._statP || ( this._statP = fs.stat( this.location ) );
  }

  async isFile() {
    if ( this._isFile == null ) {
      try {
        const s = await this._stat();
        this._isFile = s.isFile() || s.isFIFO();
      } catch ( err ) {
        if ( err.code === "ENOENT" || err.code === "ENOTDIR" ) {
          this._isFile = false;
        } else {
          throw err;
        }
      }
    }
    return this._isFile;
  }

  async isDir() {
    if ( this._isDir == null ) {
      try {
        const s = await this._stat();
        this._isDir = s.isDirectory();
      } catch ( err ) {
        if ( err.code === "ENOENT" || err.code === "ENOTDIR" ) {
          this._isDir = false;
        } else {
          throw err;
        }
      }
    }
    return this._isDir;
  }

  async getInfo() {
    return this._stat();
  }

  async getString() {
    return ( await this._read() ).toString();
  }

  async getBuffer() {
    return this._read();
  }

}

class WebFile {

  constructor( location ) {
    this.location = makeAbsolute( location );
    this._isFile = null;
    this._fetchP = null;
  }

  fromFS() {
    return false;
  }

  fromWeb() {
    return true;
  }

  _fetch() {
    return this._fetchP || ( this._fetchP = fetch( this.location ) );
  }

  async isFile() {
    if ( this._isFile == null ) {
      try {
        await this._fetch();
        this._isFile = true;
      } catch ( e ) {
        this._isFile = false;
      }
    }
    return this._isFile;
  }

  async isDir() {
    return false;
  }

  async getInfo() {
    return this._fetch();
  }

  async getString() {
    return ( await this._fetch() ).text();
  }

  async getBuffer() {
    return ( await this._fetch() ).arrayBuffer();
  }

}

const File = fs ? FsFile : WebFile;

export default File;

export { FsFile, WebFile };
