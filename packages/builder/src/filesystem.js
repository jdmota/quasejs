// @flow
const { default: FileSystem } = require( "@quase/cacheable-fs" );

export type FSOperation = "stat" | "readFile" | "readdir";

export default class TrackableFileSystem<T> extends FileSystem {

  +fileUsedBy: Map<string, Set<T>>;

  constructor() {
    super();
    this.fileUsedBy = new Map();
  }

  getObjFile( file: string, requirer: T ) {
    const obj = super.getObjFile( file );
    const set = this.fileUsedBy.get( obj.location ) || new Set();

    if ( obj.location !== requirer ) {
      set.add( requirer );
    }

    this.fileUsedBy.set( obj.location, set );
    return obj;
  }

  async stat( file: string, requirer: T ) {
    return this.getObjFile( file, requirer ).stat();
  }

  async readFile( file: string, requirer: T, enconding: ?string ) {
    return this.getObjFile( file, requirer ).readFile( enconding );
  }

  async readdir( file: string, requirer: T ) {
    return this.getObjFile( file, requirer ).readdir();
  }

  statSync( file: string, requirer: T ) {
    return this.getObjFile( file, requirer ).statSync();
  }

  readFileSync( file: string, requirer: T, encoding: ?string ) {
    return this.getObjFile( file, requirer ).readFileSync( encoding );
  }

  readdirSync( file: string, requirer: T ) {
    return this.getObjFile( file, requirer ).readdirSync();
  }

  async isFile( file: string, requirer: T ) {
    try {
      const s = await this.stat( file, requirer );
      return s.isFile() || s.isFIFO();
    } catch ( err ) {
      if ( err.code === "ENOENT" || err.code === "ENOTDIR" ) {
        return false;
      }
      throw err;
    }
  }

  isFileSync( file: string, requirer: T ) {
    try {
      const s = this.statSync( file, requirer );
      return s.isFile() || s.isFIFO();
    } catch ( err ) {
      if ( err.code === "ENOENT" || err.code === "ENOTDIR" ) {
        return false;
      }
      throw err;
    }
  }

  // React to "file changed"
  purgeContent( what: string ) {
    this.fileUsedBy.delete( what );
    super.purgeContent( what );
  }

  // React to "file added" or "file removed"
  purge( what: string ) {
    this.fileUsedBy.delete( what );
    super.purge( what );
  }

  // React to "folder added" or "folder removed"
  purgeNested( what: string ) {
    this.fileUsedBy.delete( what );
    super.purgeNested( what );
  }

}
