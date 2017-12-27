// @flow

const FileSystem = require( "@quase/memory-fs" ).default;

export default class TrackableFileSystem extends FileSystem {

  +fileUsedBy: Map<string, Set<string>>;

  constructor( opts: ?Object ) {
    super( opts );
    this.fileUsedBy = new Map();
  }

  getObjFile( file: string, _from: string ) {
    const obj = super.getObjFile( file );
    const set = this.fileUsedBy.get( obj.location ) || new Set();
    if ( file !== _from ) {
      set.add( _from );
    }
    this.fileUsedBy.set( obj.location, set );
    return obj;
  }

  async getInfo( file: string, _from: string ) {
    return this.getObjFile( file, _from ).getInfo();
  }

  async isFile( file: string, _from: string ) {
    return this.getObjFile( file, _from ).isFile();
  }

  async isDir( file: string, _from: string ) {
    return this.getObjFile( file, _from ).isDir();
  }

  async getFileBuffer( file: string, _from: string ) {
    return this.getObjFile( file, _from ).getBuffer();
  }

  async getFile( file: string, _from: string ) {
    return this.getObjFile( file, _from ).getString();
  }

  getFileBufferSync( file: string, _from: string ) {
    return this.getObjFile( file, _from ).getBufferSync();
  }

  getFileSync( file: string, _from: string ) {
    return this.getObjFile( file, _from ).getStringSync();
  }

  clone() {
    return new TrackableFileSystem( this );
  }

}
