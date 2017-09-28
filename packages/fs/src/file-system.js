import { makeAbsolute } from "../../pathname/src/path-url";
import { getFileBuffer } from "./get-file";
import isFile from "./is-file";

const LRU = require( "lru-cache" );
const Buffer = typeof global !== "undefined" && global.Buffer;
const TextDecoder = typeof window !== "undefined" && window.TextDecoder; // eslint-disable-line no-undef

function bufferToString( buf ) {
  if ( Buffer && buf instanceof Buffer ) {
    return buf.toString();
  }
  return new TextDecoder( "utf-8" ).decode( new Uint8Array( buf ) );
}

export default class FileSystem {
  constructor( opts ) {
    const { caches, files } = opts || {};
    this.caches = caches || Object.create( null );
    this.files = files || new Set();
    this.filesUsed = new Set();
  }

  _provide( providerName, fn, name ) {
    this.files.add( name );
    this.filesUsed.add( name );

    const cache = this.caches[ providerName ] || ( this.caches[ providerName ] = new LRU( 100 ) );
    let promise = cache.get( name );

    if ( !promise ) {
      promise = fn( name );
      cache.set( name, promise );
    }

    return promise;
  }

  async getFile( file ) {
    return bufferToString( await this.getFileBuffer( file ) );
  }

  getFileBuffer( file ) {
    return this._provide( "getFileBuffer", getFileBuffer, makeAbsolute( file ) );
  }

  isFile( file ) {
    return this._provide( "isFile", isFile, makeAbsolute( file ) );
  }

  purge( what ) {
    const file = makeAbsolute( what );
    for ( const name in this.caches ) {
      this.caches[ name ].del( file );
    }
    this.files.delete( file );
  }

  clone() {
    return new FileSystem( this );
  }

}
