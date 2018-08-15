// @flow
import { Producer, type IComputation } from "./utils/data-dependencies";

const { default: FileSystem } = require( "@quase/cacheable-fs" );

type FSOperation = "stat" | "readFile" | "readdir";

type FSProducers = { [key: FSOperation]: Producer<void> };

export default class DependableFileSystem extends FileSystem {

  +producersByFile: Map<string, FSProducers>;

  constructor() {
    super();
    this.producersByFile = new Map();
  }

  getObjFile( file: string, sub: IComputation, op: FSOperation ) {
    const obj = super.getObjFile( file );
    const producers = this.producersByFile.get( obj.location ) || {
      stat: new Producer(),
      readFile: new Producer(),
      readdir: new Producer()
    };
    this.producersByFile.set( obj.location, producers );
    producers[ op ].subscribe( sub );
    return obj;
  }

  async stat( file: string, sub: IComputation ) {
    return this.getObjFile( file, sub, "stat" ).stat();
  }

  async readFile( file: string, sub: IComputation, enconding: ?string ) {
    return this.getObjFile( file, sub, "readFile" ).readFile( enconding );
  }

  async readdir( file: string, sub: IComputation ) {
    return this.getObjFile( file, sub, "readdir" ).readdir();
  }

  async isFile( file: string, sub: IComputation ) {
    try {
      const s = await this.stat( file, sub );
      return s.isFile() || s.isFIFO();
    } catch ( err ) {
      if ( err.code === "ENOENT" || err.code === "ENOTDIR" ) {
        return false;
      }
      throw err;
    }
  }

  _notify( what: string, statToo: boolean ) {
    const producers = this.producersByFile.get( what );
    if ( producers ) {
      producers.readFile.notify();
      producers.readdir.notify();
      if ( statToo ) {
        producers.stat.notify();
        this.producersByFile.delete( what );
      }
    }
  }

  // React to "file changed"
  purgeContent( what: string ) {
    this._notify( what, false );
    super.purgeContent( what );
  }

  // React to "file added" or "file removed"
  purge( what: string ) {
    this._notify( what, true );
    super.purge( what );
  }

  // React to "folder added" or "folder removed"
  purgeNested( what: string ) {
    this._notify( what, true );
    super.purgeNested( what );
  }

}
