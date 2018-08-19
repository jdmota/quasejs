/* eslint-disable no-console */
import { relative } from "./id";

const prettyBytes = require( "pretty-bytes" );

export default class Reporter {

  constructor( options, builder, emitter ) {
    this.builder = builder;
    this.emitter = emitter;
    this.hideDates = !!options.hideDates;
    this.log = process.stdout.write.bind( process.stdout );

    emitter.on( "build-start", this.onBuildStart.bind( this ) );
    emitter.on( "build-success", this.onBuildSuccess.bind( this ) );
    emitter.on( "watching", this.onWatching.bind( this ) );
    emitter.on( "update", this.onUpdate.bind( this ) );
    emitter.on( "build-error", this.onBuildError.bind( this ) );
    emitter.on( "warning", this.onWarning.bind( this ) );
    emitter.on( "hmr-starting", this.onHmrStarting.bind( this ) );
    emitter.on( "hmr-started", this.onHmrStarted.bind( this ) );
    emitter.on( "hmr-error", this.onHmrError.bind( this ) );
    emitter.on( "sigint", this.onSigint.bind( this ) );
    emitter.on( "closed", this.onClosed.bind( this ) );
  }

  onWarning( w ) {
    this.log( `Warning: ${w}\n` );
  }

  onHmrStarting() {
    this.log( "HMR server starting...\n" );
  }

  onHmrStarted( { hostname, port } ) {
    this.log( `HMR server listening at ${hostname}:${port}...\n` );
  }

  onHmrError( err ) {
    console.warn( err );
  }

  onBuildStart() {
    this.log( "\n--------\n" );
  }

  onBuildSuccess( { filesInfo, time } ) {

    const { performance, cwd } = this.builder;
    const output = [ "\nAssets:\n" ];

    for ( const { file, size, isEntry } of filesInfo ) {
      if ( performance.assetFilter( file ) ) {

        let message = "";
        if ( performance.hints ) {
          if ( isEntry && size > performance.maxEntrypointSize ) {
            message = ` > ${prettyBytes( performance.maxEntrypointSize )} [performance!]`;
          } else if ( size > performance.maxAssetSize ) {
            message = ` > ${prettyBytes( performance.maxAssetSize )} [performance!]`;
          }
        }

        output.push( `${isEntry ? "[entry] " : ""}${relative( file, cwd )} | ${prettyBytes( size )}${message}` );
      }
    }

    output.push( "\n" );

    this.log( output.join( "\n" ) );

    if ( this.hideDates ) {
      this.log( "Done building.\n" );
    } else {
      const now = new Date();
      this.log( `Done building in ${time}ms. ${now.toLocaleString()}\n` );
    }

  }

  onWatching( files ) {
    this.log( `Watching ${files.length} files...\n` );
    this.log( "\n--------\n\n" );
  }

  onUpdate( { id, type } ) {
    this.log( `File ${relative( id, this.builder.cwd )} was ${type}.\n` );
  }

  onBuildError( error ) {
    this.log( `\n${error.__fromBuilder ? error.message : error.stack}\n\n` );
    this.log( "Build failed.\n" );
  }

  onSigint() {
    this.log( "Closing...\n" );
  }

  onClosed() {
    this.log( "Closed.\n" );
  }

}
