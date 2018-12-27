// Adapted from parcel-bundler's HMR server
import { formatError } from "./utils/error";
import { Updates, Output } from "./types";
import Builder from "./builder";

const http = require( "http" );
const WebSocket = require( "ws" );
const stripAnsi = require( "strip-ansi" );

export default class HMRServer {

  builder: Builder;
  server: any;
  wss: any;
  lastErrorEvent: any;
  firstBuild: boolean;

  constructor( builder: Builder ) {
    this.builder = builder;
    this.server = null;
    this.wss = null;
    this.lastErrorEvent = null;
    this.handleSocketError = this.handleSocketError.bind( this );
    this.firstBuild = true;

    this.builder.on( "build-success", ( o: Output ) => this.emitUpdate( o.updates ) );
    this.builder.on( "build-error", ( e: Error ) => this.emitError( e ) );
  }

  async start() {
    this.builder.emit( "hmr-starting" );

    this.server = http.createServer();
    this.wss = new WebSocket.Server( { server: this.server } );

    await new Promise( async r => this.server.listen( 0, "0.0.0.0", r ) );

    this.wss.on( "connection", ( ws: any ) => {
      ws.onerror = this.handleSocketError;
      if ( this.lastErrorEvent ) {
        ws.send( JSON.stringify( this.lastErrorEvent ) );
      }
    } );

    this.wss.on( "error", this.handleSocketError );

    const { port } = this.wss.address();
    const info = { hostname: "localhost", port };

    this.builder.emit( "hmr-started", info );
    return info;
  }

  stop() {
    this.wss.close();
    this.server.close();
  }

  broadcast( msg: any ) {
    const json = JSON.stringify( msg );
    for ( const ws of this.wss.clients ) {
      ws.send( json );
    }
  }

  emitUpdate( updates: Updates ) {
    if ( this.firstBuild ) {
      this.firstBuild = false;
      return;
    }

    this.lastErrorEvent = null;

    this.broadcast( {
      type: "update",
      updates
    } );
  }

  emitError( err: string | Error ) {
    if ( this.firstBuild ) {
      this.firstBuild = false;
    }

    const { message, stack } = formatError( err );

    // Store the most recent error so we can notify new connections
    this.lastErrorEvent = {
      type: "error",
      error: stripAnsi( `${message}${stack ? `\n${stack}` : ""}` )
    };

    this.broadcast( this.lastErrorEvent );
  }

  handleSocketError( err: any ) {
    if ( err.error.code === "ECONNRESET" ) {
      // This gets triggered on page refresh
      return;
    }
    this.builder.emit( "hmr-error", err );
  }
}
