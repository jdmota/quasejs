// @flow
import Builder from "./builder";

const Watchpack = require( "watchpack" );
const EventEmitter = require( "events" );

export default class Watcher extends EventEmitter {

  job: Promise<any>;
  builder: Builder;
  watcher: Watchpack;

  constructor( builder: Builder ) {
    super();

    this.job = Promise.resolve();
    this.builder = builder;
    this.watcher = new Watchpack( builder.watchOptions );

    this.watcher.on( "change", id => this.onUpdate( id, "changed" ) );
    this.watcher.on( "remove", id => this.onUpdate( id, "removed" ) );
    this.watcher.on( "aggregated", () => this.queueBuild() );

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
        o => this.emit( "build", o ),
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
      this.builder.removeFile( id, type === "removed" );
      this.emit( "update", { id, type } );
    } );
  }

  stop() {
    if ( this.watcher ) {
      this.watcher.close();
      this.watcher = null;
      this.nextJob( () => {
        this.emit( "watch-close" );
      } );
      return this.job;
    }
  }

}
