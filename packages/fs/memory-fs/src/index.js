const getFileBuffer = require( "@quase/get-file" ).getFileBuffer;
const isFile = require( "@quase/is-file" ).default;
const { makeAbsolute } = require( "@quase/path-url" );

const Buffer = typeof global !== "undefined" && global.Buffer;
const TextDecoder = ( typeof window !== "undefined" && window.TextDecoder ) || require( "util" ).TextDecoder; // eslint-disable-line no-undef
const TextEncoder = ( typeof window !== "undefined" && window.TextEncoder ) || require( "util" ).TextEncoder; // eslint-disable-line no-undef

function bufferToString( buf ) {
  if ( Buffer && buf instanceof Buffer ) {
    return buf.toString();
  }
  return new TextDecoder( "utf-8" ).decode( new Uint8Array( buf ) );
}

function stringToBuffer( str ) {
  if ( Buffer ) {
    return Buffer.from( str );
  }
  return new TextEncoder().encode( str );
}

export default class FileSystem {
  constructor( opts ) {
    const { files, data } = opts || {};
    this.files = files || new Set();
    this.data = data || Object.create( null );
    this.filesUsed = new Set();
  }

  _objFile( file ) {
    file = makeAbsolute( file );
    let obj = this.data[ file ];
    if ( !obj ) {
      this.files.add( file );
      this.filesUsed.add( file );
      obj = this.data[ file ] = {
        name: file,
        isFile: null,
        isFileP: null,
        content: null,
        contentP: null
      };
    }
    return obj;
  }

  async isFile( file ) {
    const obj = this._objFile( file );

    if ( obj.isFile != null ) {
      return obj.isFile;
    }

    obj.isFileP = obj.isFileP || isFile( obj.name ).then( b => {
      obj.isFile = b;
      obj.isFileP = null;
      return b;
    } );

    return obj.isFileP;
  }

  async getFileBuffer( file ) {
    const obj = this._objFile( file );

    if ( obj.content != null ) {
      return obj.content;
    }

    obj.contentP = obj.contentP || getFileBuffer( obj.name ).then( c => {
      obj.isFile = true;
      obj.isFileP = null;
      obj.content = c;
      obj.contentP = null;
      return c;
    } );

    return obj.contentP;
  }

  async getFile( file ) {
    return bufferToString( await this.getFileBuffer( file ) );
  }

  putFileBuffer( file, content ) {
    const obj = this._objFile( file );
    obj.isFile = true;
    obj.isFileP = null;
    obj.content = content;
    obj.contentP = null;
    return obj.content;
  }

  putFile( file, str ) {
    return this.putFileBuffer( file, stringToBuffer( str ) );
  }

  purge( what ) {
    const file = makeAbsolute( what );
    this.data[ file ] = null;
    this.files.delete( file );
  }

  clone() {
    return new FileSystem( this );
  }

}
