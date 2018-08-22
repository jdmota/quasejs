// @flow
import { lowerPath } from "./id";
import Builder from "./builder";

const Watchpack = require( "watchpack" );
const EventEmitter = require( "events" );

export default class Watcher extends EventEmitter {

  +builder: Builder;
  +updates: { path: string; type: string }[];
  currentBuild: ?Promise<any>;
  watcher: ?Object;

  constructor( builder: Builder ) {
    super();

    this.builder = builder;
    this.updates = [];
    this.currentBuild = null;

    const watcher = new Watchpack( builder.watchOptions );
    this.watcher = watcher;
    watcher.on( "change", ( id, mtime, type ) => this.onUpdate( id, type === "add" ? "added" : "changed" ) );
    watcher.on( "remove", id => this.onUpdate( id, "removed" ) );
    watcher.on( "aggregated", () => this.queueBuild() );

    const _self: any = this;
    _self.onUpdate = _self.onUpdate.bind( this );
    _self.stop = _self.stop.bind( this );
  }

  async _queueBuild() {
    this.emit( "build-start" );

    let update;
    while ( update = this.updates.pop() ) {
      if ( update.type === "added" || update.type === "removed" ) {
        // If a folder was removed, no need to purgeNested,
        // since if we depended on those files, they will be purged as well.
        this.builder.fileSystem.purge( update.path );
      } else {
        this.builder.fileSystem.purgeContent( update.path );
      }
    }

    const buildPromise = this.builder.runBuild();
    const build = this.builder.build;

    let output;
    try {
      output = await buildPromise;
      if ( build.isActive() ) {
        this.emit( "build-success", output );
      }
    } catch ( err ) {
      if ( build.isActive() ) {
        this.emit( "build-error", err );
      }
    }

    if ( build.isActive() ) {
      this.finishBuild();
    }
  }

  queueBuild() {
    return ( this.currentBuild = this._queueBuild() );
  }

  finishBuild() {
    const files = this.builder.fileSystem.watchedFiles();
    if ( this.watcher ) {
      this.watcher.watch( files, [] ); // Override the files and directories
    }
    this.emit( "watching", files );
  }

  start() {
    this.queueBuild();
    return this;
  }

  onUpdate( path: string, type: string ) {
    this.updates.push( { path: lowerPath( path ), type } );
    this.emit( "update", { path, type } );
  }

  stop() {
    if ( this.watcher ) {
      this.watcher.close();
      this.watcher = null;
      this.currentBuild = null;
    }
  }

}
