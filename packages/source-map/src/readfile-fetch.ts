export class GetFile {

  private fileCache: Map<string, Promise<string>>;
  private fetchCache: Map<string, Promise<Response>>;
  private window: Window | false;
  private fs: {
    readFile( path: string, encoding: string, callback: ( err: NodeJS.ErrnoException | null, data: string ) => void ): void;
  } | null;

  constructor() {
    this.fileCache = new Map();
    this.fetchCache = new Map();
    this.window = typeof window !== "undefined" && window; // eslint-disable-line no-undef
    this.fs = require( "fs" );
  }

  private _fetchResponse( file: string ) {
    const { window } = this;
    if ( !window ) {
      throw new Error( `No window` );
    }
    return window.fetch( file );
  }

  private _readFile( file: string ) {
    const { fs } = this;
    if ( !fs ) {
      throw new Error( `No fs` );
    }
    return new Promise<string>( ( resolve, reject ) => {
      fs.readFile( file, "utf8", ( err, result ) => {
        if ( err ) {
          reject( err );
        } else {
          resolve( result );
        }
      } );
    } );
  }

  fetchResponse( file: string ) {
    let curr = this.fetchCache.get( file );
    if ( curr ) {
      return curr;
    }
    curr = this._fetchResponse( file );
    this.fetchCache.set( file, curr );
    return curr;
  }

  async fetch( file: string ) {
    const r = await this.fetchResponse( file );
    return r.text();
  }

  readFile( file: string ) {
    let curr = this.fileCache.get( file );
    if ( curr ) {
      return curr;
    }
    curr = this._readFile( file );
    this.fileCache.set( file, curr );
    return curr;
  }

  delete( file: string ) {
    this.fileCache.delete( file );
    this.fetchCache.delete( file );
  }

}
