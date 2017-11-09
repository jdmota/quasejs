import createFile from "./file";

const { makeAbsolute } = require( "@quase/path-url" );

export default class FileSystem {
  constructor( opts ) {
    const { files, data } = opts || {};
    this.files = files || new Set();
    this.data = data || Object.create( null );
    this.filesUsed = new Set();
  }

  getObjFile( file ) {
    file = makeAbsolute( file );
    let obj = this.data[ file ];
    if ( !obj ) {
      this.files.add( file );
      this.filesUsed.add( file );
      obj = this.data[ file ] = createFile( file );
    }
    return obj;
  }

  async isFile( file ) {
    return this.getObjFile( file ).isFile();
  }

  async getFileBuffer( file ) {
    return this.getObjFile( file ).getBuffer();
  }

  async getFile( file ) {
    return this.getObjFile( file ).getString();
  }

  getFileBufferSync( file ) {
    return this.getObjFile( file ).getBufferSync();
  }

  getFileSync( file ) {
    return this.getObjFile( file ).getStringSync();
  }

  putFile( obj ) {
    const overwrite = !!this.data[ obj.location ];
    if ( !overwrite ) {
      this.files.add( obj.location );
      this.filesUsed.add( obj.location );
    }
    this.data[ obj.location ] = obj;
    return overwrite;
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
