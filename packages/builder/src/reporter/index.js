import { relative } from "../utils/path";
import Logger from "./logger";

const prettyBytes = require( "pretty-bytes" );

export default class Reporter extends Logger {

  constructor( options = {}, builder ) {
    super( options );

    builder.on( "build-start", () => {
      this.progress( "Building..." );
    } );

    builder.on( "build-success", ( { filesInfo, time } ) => {

      const COLUMNS = [
        { align: "left" }, // isEntry
        { align: "left" }, // name
        { align: "right" }, // size
        { align: "left" }, // performance message
      ];

      const { performance, dest } = builder.options;
      const table = [];

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

          table.push( [
            isEntry ? "[entry]" : "",
            relative( file, dest ),
            prettyBytes( size ),
            message
          ] );
        }
      }

      this.log( "" );
      this.table( COLUMNS, table );
      this.log( "" );

      if ( this.isTest ) {
        this.success( "Built!" );
      } else {
        const timeStr = time < 1000 ? `${time}ms` : `${( time / 1000 ).toFixed( 2 )}s`;
        this.success( `Built in ${timeStr}!` );
      }
    } );

    builder.on( "build-error", err => this.error( err ) );

    builder.on( "build-cancelled", () => {
      this.progress( "Previous build cancelled..." );
    } );

    builder.on( "watching", files => {
      this.progress( `Watching ${files.length} files...` );
    } );

    builder.on( "updates", updates => {
      this.clear();
      for ( const { path, type } of updates ) {
        this.info( `File ${relative( path, builder.options.cwd )} was ${type}.` );
      }
    } );

    builder.on( "warning", w => this.warn( w ) );

    builder.on( "hmr-starting", () => {
      this.progress( "HMR server starting..." );
    } );

    builder.on( "hmr-started", ( { hostname, port } ) => {
      this.persistent( `HMR server listening at ${hostname}:${port}...` );
    } );

    builder.on( "hmr-error", w => this.warn( w ) );

    builder.on( "sigint", () => {
      this.stopSpinner();
      this.info( "Closing..." );
    } );
  }

}
