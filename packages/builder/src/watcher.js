// @flow
import { Producer, type ComputationApi, ComputationCancelled } from "./utils/data-dependencies";
import { makeAbsolute } from "./utils/path";
import type { WatchedFileInfo } from "./types";
import type Builder from "./builder";

const path = require( "path" );
const EventEmitter = require( "events" );
// $FlowIgnore
const _FSWatcher = require( "fswatcher-child" );

type FSEffect = "changed" | "addOrRemove";
type FSProducers = { [key: FSEffect]: Producer<void> };

class FSWatcher extends _FSWatcher {

  handleEmit( event: string, data: any ) {
    if ( this.closed ) {
      return;
    }
    return super.handleEmit( event, data );
  }

  sendCommand( command: string, args: any ) {
    if ( this.closed ) {
      return;
    }
    return super.sendCommand( command, args );
  }

  add( paths: string[] ) {
    let added = false;
    for ( const p of paths ) {
      added = this._addPath( p ) || added;
    }
    if ( added ) this.sendCommand( "add", [ paths ] );
  }

  unwatch( paths: string[] ) {
    let removed = false;
    for ( const p of paths ) {
      removed = this.watchedPaths.delete( p ) || removed;
    }
    if ( removed ) this.sendCommand( "unwatch", [ paths ] );
  }

  unwatchDiff( paths: Set<string> ) {
    const remove = [];
    for ( const p of this.watchedPaths ) {
      if ( !paths.has( p ) ) {
        remove.push( p );
      }
    }
    this.unwatch( remove );
  }

}

export default class Watcher extends EventEmitter {

  +builder: Builder;
  +producersByFile: Map<string, FSProducers>;
  +updates: { path: string, type: string }[];
  currentBuild: ?Promise<any>;
  rebuildTimeout: any;
  watcher: ?FSWatcher;

  constructor( builder: Builder ) {
    super();

    this.builder = builder;
    this.producersByFile = new Map();
    this.updates = [];
    this.currentBuild = null;

    const watcher = this.watcher = new FSWatcher( {
      ignoreInitial: true,
      ignorePermissionErrors: true,
      ignored: /\.cache|\.git/,
      ...builder.options.watchOptions
    } );

    watcher
      .on( "add", path => this.onUpdate( path, "added" ) )
      .on( "change", path => this.onUpdate( path, "changed" ) )
      .on( "unlink", path => this.onUpdate( path, "removed" ) )
      .on( "addDir", path => this.onUpdate( path, "added" ) )
      .on( "unlinkDir", path => this.onUpdate( path, "removed" ) );

    // .on( "error", () => {} )
    // .on( "watcherError", () => {} )
    // .on( "ready", () => {} );
  }

  _onUpdate( path: string, type: "added" | "changed" | "removed" ) {
    this.updates.push( { path, type } );
    this.emit( "update", { path, type } );
  }

  onUpdate( path: string, type: "added" | "changed" | "removed" ) {
    this._onUpdate( path, type );

    clearTimeout( this.rebuildTimeout );
    this.rebuildTimeout = setTimeout( () => this.queueBuild(), 1000 );
  }

  watchedFiles(): Set<string> {
    return new Set( this.producersByFile.keys() );
  }

  registerFile( _path: string, info: WatchedFileInfo, computation: ComputationApi ) {
    const path = makeAbsolute( _path );
    const producers = this.producersByFile.get( path ) || {
      changed: new Producer(),
      addOrRemove: new Producer()
    };
    if ( info.onlyExistance ) {
      computation.subscribeTo( producers.addOrRemove );
    } else {
      computation.subscribeTo( producers.addOrRemove );
      computation.subscribeTo( producers.changed );
    }
    this.producersByFile.set( path, producers );
  }

  _invalidate( what: string, existance: boolean ) {
    const producers = this.producersByFile.get( what );
    if ( producers ) {
      producers.changed.invalidate();
      if ( existance ) {
        producers.addOrRemove.invalidate();
        this.producersByFile.delete( what );
        this.changed( path.dirname( what ) );
      }
    }
  }

  addedOrRemoved( what: string ) {
    this._invalidate( makeAbsolute( what ), true );
  }

  changed( what: string ) {
    this._invalidate( makeAbsolute( what ), false );
  }

  async _queueBuild( prevBuildJob: Promise<any> ) {
    if ( this.updates.length ) {
      this.emit( "updates", this.updates );
    }

    let update;
    while ( update = this.updates.pop() ) {
      if ( update.type === "added" || update.type === "removed" ) {
        this.addedOrRemoved( update.path );
      } else {
        this.changed( update.path );
      }
    }

    await prevBuildJob;

    // Start new build
    this.emit( "build-start" );

    try {
      const output = await this.builder.runBuild();
      this.emit( "build-success", output );
    } catch ( err ) {
      if ( err instanceof ComputationCancelled ) {
        this.emit( "build-cancelled" );
        return;
      }
      this.emit( "build-error", err );
    }

    // Update tracked files
    const files = this.watchedFiles();
    const filesArr = Array.from( files );
    const { watcher } = this;
    if ( watcher ) {
      watcher.add( filesArr );
      watcher.unwatchDiff( files );
    }
    this.emit( "watching", filesArr );
  }

  queueBuild() {
    const prev = this.currentBuild || Promise.resolve();
    return ( this.currentBuild = this._queueBuild( prev ) );
  }

  start() {
    this.queueBuild();
    return this;
  }

  stop() {
    this.builder.stop();
    if ( this.watcher ) {
      this.watcher.close();
      this.watcher = null;
      this.currentBuild = null;
    }
  }

}
