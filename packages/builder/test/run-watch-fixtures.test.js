import index from "../dist";
import Reporter from "../dist/reporter";
import transformConfig from "./transform-config";

const fs = require( "fs-extra" );
const path = require( "path" );
const stripAnsi = require( "strip-ansi" );

const FIXTURES = path.resolve( "packages/builder/test/watch-fixtures" );
const folders = fs.readdirSync( FIXTURES );

class TestReporter extends Reporter {
  constructor( opts, builder ) {
    super( opts, builder );
    this.output = "";
  }
  _log( message ) {
    this.output += stripAnsi( message ) + "\n";
  }
}

describe( "watcher", () => {

  folders.forEach( folder => {

    if ( folder === "__dev__" ) {
      return;
    }

    jest.setTimeout( 60000 );

    it( `Fixture: watch-fixtures/${folder}`, async() => {

      const fixturePath = path.resolve( FIXTURES, folder );
      const filesPath = path.resolve( fixturePath, "files" );
      const workingPath = path.resolve( fixturePath, "working" );
      const assets = {};

      await fs.emptyDir( workingPath );
      await fs.copy( filesPath, workingPath );

      let config;
      try {
        config = require( path.resolve( fixturePath, "config.js" ) );
      } catch ( err ) {
        config = {};
      }

      config.entries = config.entries || [ "index.js" ];
      config.context = config.context || "working";
      config.dest = config.dest || "atual";
      config.watch = true;
      config.watchOptions = {
        aggregateTimeout: 1
      };
      config.fs = {
        mkdirp: () => {},
        writeFile: ( file, content ) => {
          expect( path.isAbsolute( file ) ).toBe( true );

          assets[ path.relative( fixturePath, file ).replace( /\\/g, "/" ) ] = content;
        }
      };

      config.reporter = [
        TestReporter,
        {
          logLevel: 5,
          color: false,
          emoji: false,
          isTest: true
        }
      ];

      config = transformConfig( config, fixturePath );

      const { reporter, builder, watcher } = index( config, true );

      watcher.watcher.close();

      function update( file, type ) {
        file = path.sep === "\\" ? file.toLowerCase() : file;
        if ( watcher.watcher.watchedPaths.has( file ) ) {
          watcher._onUpdate( file, type );
          return true;
        }
        return false;
      }

      let resolve;
      const promise = new Promise( a => {
        resolve = a;
      } );

      const operations = require( path.resolve( fixturePath, "operations.js" ) );
      let i = 0;

      async function next() {

        if ( i >= operations.length ) {
          builder.stop();
          resolve();
          return;
        }

        let [ action, arg1, arg2 ] = operations[ i ];
        arg1 = path.resolve( workingPath, arg1 );

        switch ( action ) {
          case "newFile":
            await fs.writeFile( arg1, arg2 );
            if ( update( arg1, "added" ) ) {
              watcher.queueBuild();
            }
            break;
          case "writeFile":
            await fs.writeFile( arg1, arg2 );
            if ( update( arg1, "changed" ) ) {
              watcher.queueBuild();
            }
            break;
          case "ensureDir":
            await fs.ensureDir( arg1 );
            break;
          case "rename":
            arg2 = path.resolve( workingPath, arg2 );
            await fs.rename( arg1, arg2 );
            if ( update( arg1, "removed" ) || update( arg2, "added" ) ) {
              watcher.queueBuild();
            }
            break;
          case "remove":
            await fs.remove( arg1 );
            if ( update( arg1, "removed" ) ) {
              watcher.queueBuild();
            }
            break;
          default:
            throw new Error( `Invalid action: ${action}` );
        }

        i++;
        watcher.currentBuild.then( next );
      }

      watcher.currentBuild.then( next );

      await promise;

      expect( assets ).toMatchSnapshot();
      expect( reporter.output ).toMatchSnapshot();

    } );

  } );

} );
