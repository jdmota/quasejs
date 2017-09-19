import { reportText } from "./utils/error";
import Bundle from "./bundle";

const Watchpack = require( "watchpack" );

export default class Watcher {

  constructor( options ) {

    this.time = 0;
    this.needsBuild = false;
    this.filesThatTriggerBuild = null;

    this._hideDates = options._hideDates;
    this.codeFrameOpts = options.cli && options.cli.codeFrame;

    this.job = Promise.resolve();
    this.bundle = new Bundle( options );
    this.watcher = new Watchpack( options.watchOptions );

    this.log = process.stdout.write.bind( process.stdout );
    this.onUpdate = this.onUpdate.bind( this );
    this.stop = this.stop.bind( this );

    this.watcher.on( "change", id => this.onUpdate( id, "changed" ) );
    this.watcher.on( "remove", id => this.onUpdate( id, "removed" ) );
    this.watcher.on( "aggregated", () => this.queueBuild() );

    process.once( "SIGINT", this.stop );
    process.once( "SIGTERM", this.stop );
  }

  queueBuild() {
    this.nextJob( () => {
      if ( this.needsBuild ) {
        this.needsBuild = false;
        this.time = Date.now();
        return this.bundle.build().then( () => this.finishBuild(), e => {
          this.log( reportText( e, this.codeFrameOpts ) );
          this.finishBuild( true );
        } );
      }
      this.log( "Build not necessary.\n" );
      this.log( "\n--------\n\n" );
    } );
  }

  finishBuild( failed ) {
    if ( failed ) {
      this.log( "Build failed.\n" );
    } else {
      if ( this._hideDates ) {
        this.log( "Done building.\n" );
      } else {
        const now = new Date();
        this.log( `Done building in ${+now - this.time}ms. ${now.toLocaleString()}\n` );
      }
    }

    const files = Array.from( this.bundle.fileSystem.files );
    if ( this.watcher ) {
      this.watcher.watch( files, [] ); // Override the files and directories
      this.log( `Watching ${files.length} files...\n` );
    }
    this.log( "\n--------\n\n" );

    this.filesThatTriggerBuild = this.bundle.fileSystem.filesThatTriggerBuild;
    this.bundle = this.bundle.clone();
  }

  nextJob( cb ) {
    this.job = this.job.then( cb );
  }

  start() {
    this.needsBuild = true;
    this.queueBuild();
    this.log( "\n\n" );
    return this;
  }

  onUpdate( id, type ) {
    this.nextJob( () => {
      this.needsBuild = this.needsBuild || this.filesThatTriggerBuild.has( id );
      this.log( `File ${this.bundle.normalizeId( id )} was ${type}.\n` );
      if ( this.bundle.modules ) {
        this.bundle.modules.delete( id );
      }
      this.bundle.fileSystem.purge( id );
    } );
  }

  stop() {
    if ( this.watcher ) {
      this.watcher.close();
      this.watcher = null;
      this.nextJob( () => {
        this.log( "Closed.\n" );
      } );
      return this.job;
    }
  }

}
