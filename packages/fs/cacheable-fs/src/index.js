import { dirname, makeAbsolutePath } from "./util";
import File from "./file";

export default class FileSystem {

  constructor() {
    this.data = new Map();
  }

  getObjFile( file ) {
    file = makeAbsolutePath( file );
    let obj = this.data.get( file );
    if ( !obj ) {
      obj = new File( file );
      this.data.set( file, obj );
    }
    return obj;
  }

  async stat( file ) {
    return this.getObjFile( file ).stat();
  }

  async readFile( file, enconding ) {
    return this.getObjFile( file ).readFile( enconding );
  }

  async readdir( dir ) {
    return this.getObjFile( dir ).readdir();
  }

  statSync( file ) {
    return this.getObjFile( file ).statSync();
  }

  readFileSync( file, encoding ) {
    return this.getObjFile( file ).readFileSync( encoding );
  }

  readdirSync( file ) {
    return this.getObjFile( file ).readdirSync();
  }

  putFile( obj ) {
    const overwrite = this.data.has( obj.location );
    this.data.set( obj.location, obj );
    return overwrite;
  }

  purge( what ) {
    const file = makeAbsolutePath( what );
    this.data.delete( dirname( file ) );
    this.data.delete( file );
  }

}
