// @flow
import { lowerPath } from "./id";
import Builder from "./builder";

const Watchpack = require( "watchpack" );
const EventEmitter = require( "events" );

export default class Watcher extends EventEmitter {

  +builder: Builder;
  watcher: ?Object;
  job: Promise<any>;

  constructor( builder: Builder ) {
    super();

    this.job = Promise.resolve();
    this.builder = builder;

    const watcher = new Watchpack( builder.watchOptions );
    this.watcher = watcher;
    watcher.on( "change", ( id, mtime, type ) => this.onUpdate( id, type === "add" ? "added" : "changed" ) );
    watcher.on( "remove", id => this.onUpdate( id, "removed" ) );
    watcher.on( "aggregated", () => this.queueBuild() );

    process.once( "SIGINT", this.stop );
    process.once( "SIGTERM", this.stop );

    const _self: any = this;
    _self.onUpdate = _self.onUpdate.bind( this );
    _self.stop = _self.stop.bind( this );
  }

  queueBuild() {
    this.nextJob( () => {
      this.emit( "build-start" );
      return this.builder.build().then(
        o => this.emit( "build-success", o ),
        e => this.emit( "build-error", e )
      ).then( () => this.finishBuild() );
    } );
  }

  finishBuild() {
    const files = Array.from( this.builder.fileSystem.data.keys() );
    if ( this.watcher ) {
      this.watcher.watch( files, [] ); // Override the files and directories
    }
    this.emit( "watching", files );
  }

  nextJob( cb: Function ) {
    this.job = this.job.then( cb );
  }

  start() {
    this.queueBuild();
    return this;
  }

  onUpdate( id: string, type: string ) {
    this.nextJob( () => {

      const path = lowerPath( id );

      if ( type === "added" || type === "removed" ) {
        // If a folder was removed, no need to purgeNested,
        // since if we depended on those files, they will be purged as well.
        this.builder.fileSystem.purge( path );
      } else {
        this.builder.fileSystem.purgeContent( path );
      }

      this.emit( "update", { id, type } );
    } );
  }

  stop() {
    if ( this.watcher ) {
      this.watcher.close();
      this.watcher = null;
      return this.job;
    }
  }

}
