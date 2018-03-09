/* eslint-disable no-console */
import { reportText } from "./utils/error";
import { relative } from "./id";

const prettyBytes = require( "pretty-bytes" );

export default class Reporter {

  constructor( options, builder, emitter ) {
    this.builder = builder;
    this.emitter = emitter;
    this.time = undefined;
    this.first = true;
    this.hideDates = !!options.hideDates;
    this.codeFrameOpts = this.builder.cli.codeFrame;
    this.log = process.stdout.write.bind( process.stdout );

    emitter.on( "build-start", this.onBuildStart.bind( this ) );
    emitter.on( "build-unnecessary", this.onBuildUnnecessary.bind( this ) );
    emitter.on( "build", this.onBuild.bind( this ) );
    emitter.on( "watching", this.onWatching.bind( this ) );
    emitter.on( "update", this.onUpdate.bind( this ) );
    emitter.on( "build-error", this.onBuildError.bind( this ) );
    emitter.on( "watch-close", this.onWatchClose.bind( this ) );
    emitter.on( "warning", this.onWarning.bind( this ) );
  }

  onWarning( w ) {
    this.log( `Warning: ${w}\n` );
  }

  onBuildStart() {
    if ( this.first ) {
      this.log( "\n\n" );
      this.first = false;
    }
    this.log( "\n--------\n" );
    this.time = Date.now();
  }

  onBuildUnnecessary() {
    this.log( "Build not necessary.\n" );
    this.log( "\n--------\n\n" );
  }

  onBuild( { filesInfo } ) {

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
      this.log( `Done building in ${+now - this.time}ms. ${now.toLocaleString()}\n` );
    }

  }

  onWatching( files ) {
    this.log( `Watching ${files.length} files...\n` );
    this.log( "\n--------\n\n" );
  }

  onUpdate( { id, type } ) {
    this.log( `File ${relative( id, this.builder.cwd )} was ${type}.\n` );
  }

  onBuildError( e ) {
    this.log( reportText( e, this.codeFrameOpts ) );
    this.log( "Build failed.\n" );
  }

  onWatchClose() {
    this.log( "Closed.\n" );
  }

}
