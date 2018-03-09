import index from "../src";
import transformConfig from "./transform-config";

describe( "watcher", () => {

  const fs = require( "fs-extra" );
  const path = require( "path" );

  const FIXTURES = path.resolve( "packages/builder/test/watch-fixtures" );
  const folders = fs.readdirSync( FIXTURES );

  folders.forEach( folder => {

    if ( folder === "__dev__" ) {
      return;
    }

    it( `Fixture: watch-fixtures/${folder}`, async() => {

      jest.setTimeout( 20000 );

      const fixturePath = path.resolve( FIXTURES, folder );
      const filesPath = path.resolve( fixturePath, "files" );
      const workingPath = path.resolve( fixturePath, "working" );
      const assets = {};

      await fs.emptyDir( workingPath );
      await fs.copy( filesPath, workingPath );

      let config = require( path.resolve( fixturePath, "config.js" ) );
      config.entries = config.entries || [ "index.js" ];
      config.context = config.context || "working";
      config.dest = config.dest || "atual";
      config.reporter = [ "default", { hideDates: true } ];
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
      config = transformConfig( config, fixturePath );

      let output = "";

      const reporter = index( config );

      reporter.log = str => {
        output += str;
      };

      const b = reporter.emitter;
      b.watcher = {
        _files: null,
        _dirs: null,
        watch( files, dirs ) {
          this._files = files;
          this._dirs = dirs;
        },
        close() {}
      };

      function update( file, type ) {
        file = path.sep === "\\" ? file.toLowerCase() : file;
        if ( b.watcher._files && b.watcher._files.indexOf( file ) > -1 ) {
          b.onUpdate( file, type );
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
          b.stop().then( resolve );
          return;
        }

        let [ action, arg1, arg2 ] = operations[ i ];
        arg1 = path.resolve( workingPath, arg1 );

        switch ( action ) {
          case "writeFile":
            await fs.writeFile( arg1, arg2 );
            if ( update( arg1, "changed" ) ) {
              b.queueBuild();
            }
            break;
          case "ensureDir":
            await fs.ensureDir( arg1 );
            break;
          case "rename":
            arg2 = path.resolve( workingPath, arg2 );
            await fs.rename( arg1, arg2 );
            if ( update( arg1, "removed" ) || update( arg2, "changed" ) ) {
              b.queueBuild();
            }
            break;
          case "remove":
            await fs.remove( arg1 );
            if ( update( arg1, "removed" ) ) {
              b.queueBuild();
            }
            break;
          case "copy":
            arg2 = path.resolve( workingPath, arg2 );
            await fs.copy( arg1, arg2 );
            if ( update( arg2, "changed" ) ) {
              b.queueBuild();
            }
            break;
          default:
        }

        i++;

        b.nextJob( () => {
          setTimeout( next, 100 );
        } );

      }

      b.nextJob( () => {
        setTimeout( next, 100 );
      } );

      await promise;

      expect( assets ).toMatchSnapshot();
      expect( output ).toMatchSnapshot();

    } );

  } );

} );
