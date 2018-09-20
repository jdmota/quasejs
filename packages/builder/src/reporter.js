/* eslint-disable no-console */
import { relative } from "./utils/path";

const prettyBytes = require( "pretty-bytes" );

export default class Reporter {

  constructor( options, builder, emitter ) {
    this.builder = builder;
    this.emitter = emitter;
    this.hideDates = !!options.hideDates;
    this.log = process.stdout.write.bind( process.stdout );

    emitter.on( "build-start", this.onBuildStart.bind( this ) );
    emitter.on( "build-success", this.onBuildSuccess.bind( this ) );
    emitter.on( "build-error", this.onBuildError.bind( this ) );
    emitter.on( "build-cancelled", this.onBuildCancellation.bind( this ) );
    emitter.on( "watching", this.onWatching.bind( this ) );
    emitter.on( "updates", this.onUpdates.bind( this ) );
    emitter.on( "warning", this.onWarning.bind( this ) );
    emitter.on( "hmr-starting", this.onHmrStarting.bind( this ) );
    emitter.on( "hmr-started", this.onHmrStarted.bind( this ) );
    emitter.on( "hmr-error", this.onHmrError.bind( this ) );
    emitter.on( "sigint", this.onSigint.bind( this ) );
    emitter.on( "closed", this.onClosed.bind( this ) );
  }

  onWarning( w ) {
    this.log( "\n--------\n" );
    this.log( `\nWarning: ${w}\n` );
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
    this.log( "\nStarting new build...\n" );
  }

  onBuildSuccess( { filesInfo, time } ) {

    this.log( "\n--------\n" );

    const { performance, cwd } = this.builder.options;
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
      this.log( `Done building in ${time}ms.\n` );
    }
  }

  onBuildError( error ) {
    this.log( "\n--------\n" );
    this.log( `\n${error.__fromBuilder ? error.message : error.stack}\n` );
    this.log( "\nBuild failed.\n" );
  }

  onBuildCancellation() {
    this.log( "\n--------\n" );
    this.log( `\nPrevious build cancelled.\n` );
  }

  onWatching( files ) {
    this.log( "\n--------\n" );
    this.log( `\nWatching ${files.length} files...\n` );
  }

  onWatchingAll( files ) {
    this.log( "\n--------\n" );
    this.log( `\nWatching:\n` );
    for ( const f of files.sort() ) {
      this.log( `\n${relative( f, this.builder.options.cwd )}` );
    }
    this.log( "\n" );
  }

  onUpdates( updates ) {
    this.log( "\n--------\n" );
    for ( const { path, type } of updates ) {
      this.log( `\nFile ${relative( path, this.builder.options.cwd )} was ${type}.` );
    }
    this.log( "\n" );
  }

  onSigint() {
    this.log( "\n--------\n" );
    this.log( "\nClosing...\n" );
  }

  onClosed() {
    this.log( "\n--------\n" );
    this.log( "\nClosed.\n" );
  }

}
