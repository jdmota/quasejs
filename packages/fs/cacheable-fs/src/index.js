// @flow
import { dirname, makeAbsolutePath } from "./util";
import File from "./file";

export default class FileSystem {

  +data: Map<string, File>;

  constructor() {
    this.data = new Map();
  }

  getObjFile( file: string ): File {
    file = makeAbsolutePath( file );
    let obj = this.data.get( file );
    if ( !obj ) {
      obj = new File( file );
      this.data.set( file, obj );
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

  statSync( file: string ) {
    return this.getObjFile( file ).statSync();
  }

  readFileSync( file: string, encoding: ?string ) {
    return this.getObjFile( file ).readFileSync( encoding );
  }

  readdirSync( dir: string ) {
    return this.getObjFile( dir ).readdirSync();
  }

  putFile( obj: File ): boolean {
    const overwrite = this.data.has( obj.location );
    this.data.set( obj.location, obj );
    return overwrite;
  }

  purge( what: string ) {
    const file = makeAbsolutePath( what );
    this.data.delete( dirname( file ) );
    this.data.delete( file );
  }

}
