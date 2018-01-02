const windowFetch = typeof window !== "undefined" && window.fetch; // eslint-disable-line no-undef
const fs = !windowFetch && require( "fs-extra" );
const fetch = windowFetch || require( "node-fetch" );
const { isUrl, makeAbsolutePath, makeAbsoluteUrl } = require( "@quase/path-url" );

class FsFile {

  constructor( location ) {
    this.location = makeAbsolutePath( location );
    this._isFile = null;
    this._isDir = null;
    this._readP = null;
    this._readdirP = null;
    this._statP = null;
    this._buffer = null;
    this._files = null;
  }

  fromFS() {
    return true;
  }

  fromWeb() {
    return false;
  }

  _read() {
    return this._readP || ( this._readP = fs.readFile( this.location ).then( b => {
      this._isFile = true;
      this._buffer = b;
      return b;
    } ) );
  }

  _readdir() {
    return this._readdirP || ( this._readdirP = fs.readdir( this.location ).then( f => {
      this._isDir = true;
      this._files = f;
      return f;
    } ) );
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

  getBufferSync() {
    if ( this._buffer == null ) {
      this._buffer = fs.readFileSync( this.location );
      this._readP = Promise.resolve( this._buffer );
    }
    return this._buffer;
  }

  getStringSync() {
    return this.getBufferSync().toString();
  }

  async readdir() {
    return this._readdir();
  }

  async readdirSync() {
    if ( this._files == null ) {
      this._files = fs.readdirSync( this.location );
      this._readdirP = Promise.resolve( this._files );
    }
    return this._files;
  }

}

function syncFetch() {
  throw new Error( "Sync fetch is not supported." );
}

class WebFile {

  constructor( location ) {
    this.location = makeAbsoluteUrl( location );
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

  getBufferSync() {
    syncFetch();
  }

  getStringSync() {
    syncFetch();
  }

}

export default function( location ) {
  return isUrl( location ) ? new WebFile( location ) : new FsFile( location );
}

export { FsFile, WebFile };
