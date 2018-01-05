// @flow

import { reportText } from "./utils/error";
import { relative } from "./id";
import type { Options } from "./types";
import Builder from "./builder";

const Watchpack = require( "watchpack" );

export default class Watcher {

  time: number;
  needsBuild: boolean;
  filesThatTriggerBuild: Set<string>;
  _hideDates: boolean;
  codeFrameOpts: ?Object;
  job: Promise<any>;
  builder: Builder;
  watcher: Watchpack;
  log: Function;

  constructor( options: Options ) {

    this.time = 0;
    this.needsBuild = false;
    this.filesThatTriggerBuild = new Set();

    this._hideDates = !!options._hideDates;
    this.codeFrameOpts = options.cli && options.cli.codeFrame;

    this.job = Promise.resolve();
    this.builder = new Builder( options );
    this.watcher = new Watchpack( options.watchOptions );

    this.log = process.stdout.write.bind( process.stdout );

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
      if ( this.needsBuild ) {
        this.log( "\n--------\n" );
        this.needsBuild = false;
        this.time = Date.now();
        return this.builder.build().then(
          ( { output } ) => {
            this.log( output );
            this.finishBuild( true );
          },
          e => {
            this.log( reportText( e, this.codeFrameOpts ) );
            this.finishBuild( false );
          }
        );
      }
      this.log( "Build not necessary.\n" );
      this.log( "\n--------\n\n" );
    } );
  }

  finishBuild( ok: boolean ) {
    if ( ok ) {
      if ( this._hideDates ) {
        this.log( "Done building.\n" );
      } else {
        const now = new Date();
        this.log( `Done building in ${+now - this.time}ms. ${now.toLocaleString()}\n` );
      }
    } else {
      this.log( "Build failed.\n" );
    }

    const files = Array.from( this.builder.fileSystem.data.keys() );
    if ( this.watcher ) {
      this.watcher.watch( files, [] ); // Override the files and directories
      this.log( `Watching ${files.length} files...\n` );
    }
    this.log( "\n--------\n\n" );

    this.filesThatTriggerBuild = new Set( this.builder.fileSystem.fileUsedBy.keys() );
  }

  nextJob( cb: Function ) {
    this.job = this.job.then( cb );
  }

  start() {
    this.needsBuild = true;
    this.queueBuild();
    this.log( "\n\n" );
    return this;
  }

  onUpdate( id: string, type: string ) {
    this.nextJob( () => {
      this.needsBuild = this.needsBuild || this.filesThatTriggerBuild.has( id ) || !!this.builder.entries.find( e => e === id );
      this.builder.removeFile( id );
      this.log( `File ${relative( id, this.builder.cwd )} was ${type}.\n` );
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
