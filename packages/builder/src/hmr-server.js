// Adapted from https://github.com/parcel-bundler/parcel/blob/master/src/HMRServer.js

const http = require( "http" );
const WebSocket = require( "ws" );
const stripAnsi = require( "strip-ansi" );

export default class HMRServer {

  constructor( emitter ) {
    this.emitter = emitter;
    this.server = null;
    this.wss = null;
    this.lastErrorEvent = null;
    this.handleSocketError = this.handleSocketError.bind( this );
    this.firstBuild = true;

    this.emitter.on( "build-success", o => this.emitUpdate( o.update ) );
    this.emitter.on( "build-error", e => this.emitError( e ) );
  }

  async start() {
    this.emitter.emit( "hmr-starting" );

    this.server = http.createServer();
    this.wss = new WebSocket.Server( { server: this.server } );

    await new Promise( async r => this.server.listen( 0, "0.0.0.0", r ) );

    this.wss.on( "connection", ws => {
      ws.onerror = this.handleSocketError;
      if ( this.lastErrorEvent ) {
        ws.send( JSON.stringify( this.lastErrorEvent ) );
      }
    } );

    this.wss.on( "error", this.handleSocketError );

    const { port } = this.wss.address();
    const info = { hostname: "localhost", port };

    this.emitter.emit( "hmr-started", info );
    return info;
  }

  stop() {
    this.wss.close();
    this.server.close();
  }

  broadcast( msg ) {
    const json = JSON.stringify( msg );
    for ( const ws of this.wss.clients ) {
      ws.send( json );
    }
  }

  emitUpdate( update ) {
    if ( this.firstBuild ) {
      this.firstBuild = false;
      return;
    }

    this.lastErrorEvent = null;

    this.broadcast( {
      type: "update",
      update
    } );
  }

  emitError( err ) {
    if ( this.firstBuild ) {
      this.firstBuild = false;
    }

    // Store the most recent error so we can notify new connections
    this.lastErrorEvent = {
      type: "error",
      error: {
        message: stripAnsi( err.message ),
        stack: err.__fromBuilder ? "" : stripAnsi( err.stack )
      }
    };

    this.broadcast( this.lastErrorEvent );
  }

  handleSocketError( err ) {
    if ( err.error.code === "ECONNRESET" ) {
      // This gets triggered on page refresh
      return;
    }
    this.emitter.emit( "hmr-error", err );
  }
}
