// @flow
const { default: FileSystem, makeAbsolutePath } = require( "@quase/cacheable-fs" );

export default class TrackableFileSystem extends FileSystem {

  +fileUsedBy: Map<string, Set<string>>;

  constructor() {
    super();
    this.fileUsedBy = new Map();
  }

  getObjFile( file: string, _from: string ) {
    _from = makeAbsolutePath( _from );

    const obj = super.getObjFile( file );
    const set = this.fileUsedBy.get( obj.location ) || new Set();

    if ( obj.location !== _from ) {
      set.add( _from );
    }

    this.fileUsedBy.set( obj.location, set );
    return obj;
  }

  async stat( file: string, _from: string ) {
    return this.getObjFile( file, _from ).stat();
  }

  async readFile( file: string, _from: string, enconding: ?string ) {
    return this.getObjFile( file, _from ).readFile( enconding );
  }

  async readdir( file: string, _from: string ) {
    return this.getObjFile( file, _from ).readdir();
  }

  statSync( file: string, _from: string ) {
    return this.getObjFile( file, _from ).statSync();
  }

  readFileSync( file: string, _from: string, encoding: ?string ) {
    return this.getObjFile( file, _from ).readFileSync( encoding );
  }

  readdirSync( file: string, _from: string ) {
    return this.getObjFile( file, _from ).readdirSync();
  }

  async isFile( file: string, _from: string ) {
    try {
      const s = await this.stat( file, _from );
      return s.isFile() || s.isFIFO();
    } catch ( err ) {
      if ( err.code === "ENOENT" || err.code === "ENOTDIR" ) {
        return false;
      }
      throw err;
    }
  }

  isFileSync( file: string, _from: string ) {
    try {
      const s = this.statSync( file, _from );
      return s.isFile() || s.isFIFO();
    } catch ( err ) {
      if ( err.code === "ENOENT" || err.code === "ENOTDIR" ) {
        return false;
      }
      throw err;
    }
  }

}
