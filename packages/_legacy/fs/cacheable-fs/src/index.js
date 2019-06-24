// @flow
import { dirname, makeAbsolutePath } from "./util";
import File from "./file";

export { File, dirname, makeAbsolutePath };

export default class FileSystem {

  +data: Map<string, File>;
  +directChilds: Map<string, Set<string>>;

  constructor() {
    this.data = new Map();
    this.directChilds = new Map();
  }

  _setDirectChild( file: string ) {
    const parent = dirname( file );
    const set = this.directChilds.get( parent ) || new Set();
    set.add( file );
    this.directChilds.set( parent, set );
  }

  getObjFile( file: string ): File {
    file = makeAbsolutePath( file );
    let obj = this.data.get( file );
    if ( !obj ) {
      obj = new File( file );
      this.data.set( file, obj );
      this._setDirectChild( file );
    }
    return obj;
  }

  async stat( file: string ) {
    return this.getObjFile( file ).stat();
  }

  async readFile( file: string, enconding: ?string ) {
    return this.getObjFile( file ).readFile( enconding );
  }

  async readdir( dir: string ) {
    return this.getObjFile( dir ).readdir();
  }

  putFile( obj: File ): boolean {
    const overwrite = this.data.has( obj.location );
    this.data.set( obj.location, obj );
    return overwrite;
  }

  _purge( file: string, level: number ) {
    const parent = dirname( file );
    const fileObj = this.data.get( file );

    // Remove cached contents
    if ( level > 0 ) {
      if ( fileObj ) {
        fileObj.purgeContent();
      }
    }

    // Remove file and cached readdir of the parent
    if ( level > 1 ) {
      this.data.delete( file );
      this.data.delete( parent );

      const set = this.directChilds.get( parent );
      if ( set ) {
        set.delete( file );
      }
    }

    // Remove all nested contents
    if ( level > 2 ) {
      const set = this.directChilds.get( file );
      if ( set ) {
        for ( const f of set ) {
          this._purge( f, 3 );
        }
        this.directChilds.delete( file );
      }
    }
  }

  // React to "file changed"
  purgeContent( what: string ) {
    this._purge( makeAbsolutePath( what ), 1 );
  }

  // React to "file added" or "file removed"
  purge( what: string ) {
    this._purge( makeAbsolutePath( what ), 2 );
  }

  // React to "folder added" or "folder removed"
  purgeNested( what: string ) {
    this._purge( makeAbsolutePath( what ), 3 );
  }

}
