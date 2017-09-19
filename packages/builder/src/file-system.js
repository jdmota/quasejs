const fs = require( "fs-extra" );
const LRU = require( "lru-cache" );

class Storage {
  constructor( maxSize ) {
    this.running = {};
    this.lru = new LRU( maxSize );
  }

  finished( name, err, result ) {
    this.lru.set( name, [ err, result ] );

    const callbacks = this.running[ name ];
    this.running[ name ] = undefined;
    for ( let i = 0; i < callbacks.length; i++ ) {
      callbacks[ i ]( err, result );
    }
  }

  provide( providerName, name, callback ) {
    const running = this.running[ name ];
    if ( running ) {
      running.push( callback );
      return;
    }
    const data = this.lru.get( name );
    if ( data ) {
      return process.nextTick( () => callback( data[ 0 ], data[ 1 ] ) );
    }
    this.running[ name ] = [ callback ];
    fs[ providerName ]( name, ( err, result ) => {
      this.finished( name, err, result );
    } );
  }

  purge( what ) {
    this.lru.del( what );
  }
}

export default class FileSystem {
  constructor( opts ) {
    const { statStorage, readFileStorage, files } = opts || {};

    this.statStorage = statStorage || new Storage( 200 );
    this.readFileStorage = readFileStorage || new Storage( 100 );
    this.files = files || new Set();
    this.filesThatTriggerBuild = new Set();

    this.readFile = this.readFile.bind( this );
    this.isFile = this.isFile.bind( this );
  }
  readFile( file, cb ) {
    this.files.add( file );
    this.filesThatTriggerBuild.add( file );
    this.readFileStorage.provide( "readFile", file, cb );
  }
  isFile( file, cb ) {
    this.files.add( file );
    this.filesThatTriggerBuild.add( file );
    this.statStorage.provide( "stat", file, ( err, stat ) => {
      if ( err && err.code === "ENOENT" ) cb( null, false );
      else if ( err ) cb( err );
      else cb( null, stat.isFile() || stat.isFIFO() );
    } );
  }
  purge( what ) {
    this.statStorage.purge( what );
    this.readFileStorage.purge( what );
    this.files.delete( what );
  }
  clone() {
    return new FileSystem( {
      statStorage: this.statStorage,
      readFileStorage: this.readFileStorage,
      files: this.files
    } );
  }
}
