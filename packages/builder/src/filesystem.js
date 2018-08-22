// @flow
import { Producer, type ComputationApi } from "./utils/data-dependencies";

const { default: FileSystem } = require( "@quase/cacheable-fs" );

type FSOperation = "stat" | "readFile" | "readdir";

type FSProducers = { [key: FSOperation]: Producer<void> };

export default class DependableFileSystem extends FileSystem {

  +producersByFile: Map<string, FSProducers>;

  constructor() {
    super();
    this.producersByFile = new Map();
  }

  watchedFiles(): string[] {
    return Array.from( this.producersByFile.keys() );
  }

  getObjFile( file: string, computation: ComputationApi, op: FSOperation ) {
    const obj = super.getObjFile( file );
    const producers = this.producersByFile.get( obj.location ) || {
      stat: new Producer(),
      readFile: new Producer(),
      readdir: new Producer()
    };
    computation.subscribeTo( producers[ op ] );
    this.producersByFile.set( obj.location, producers );
    return obj;
  }

  async stat( file: string, sub: ComputationApi ) {
    return this.getObjFile( file, sub, "stat" ).stat();
  }

  async readFile( file: string, sub: ComputationApi, enconding: ?string ) {
    return this.getObjFile( file, sub, "readFile" ).readFile( enconding );
  }

  async readdir( file: string, sub: ComputationApi ) {
    return this.getObjFile( file, sub, "readdir" ).readdir();
  }

  async isFile( file: string, sub: ComputationApi ) {
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

  _invalidate( what: string, statToo: boolean ) {
    const producers = this.producersByFile.get( what );
    if ( producers ) {
      producers.readFile.invalidate();
      producers.readdir.invalidate();
      if ( statToo ) {
        producers.stat.invalidate();
        this.producersByFile.delete( what );
      }
    }
  }

  // React to "file changed"
  purgeContent( what: string ) {
    this._invalidate( what, false );
    super.purgeContent( what );
  }

  // React to "file added" or "file removed"
  purge( what: string ) {
    this._invalidate( what, true );
    super.purge( what );
  }

  // React to "folder added" or "folder removed"
  purgeNested( what: string ) {
    this._invalidate( what, true );
    super.purgeNested( what );
  }

}
