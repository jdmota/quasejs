import { plugin as jsPlugin, resolver as jsResolver, checker as jsChecker, renderer as jsRenderer } from "../src/plugins/js";
import { Watcher } from "../src";

describe( "watcher", () => {

  const fs = require( "fs-extra" );
  const path = require( "path" );

  const FIXTURES = path.resolve( "packages/builder/test/watch-fixtures" );
  const folders = fs.readdirSync( FIXTURES );

  folders.forEach( folder => {

    it( `Fixture: watch-fixtures/${folder}`, async() => {

      const fixturePath = path.resolve( FIXTURES, folder );
      const filesPath = path.resolve( fixturePath, "files" );
      const workingPath = path.resolve( fixturePath, "working" );

      await fs.emptyDir( workingPath );
      await fs.copy( filesPath, workingPath );

      const config = require( path.resolve( fixturePath, "config.js" ) );

      config.sourceMaps = config.sourceMaps === undefined ? true : config.sourceMaps;
      config.plugins = [
        obj => {
          if ( obj.type === "ts" ) {
            obj.type = "js";
            return obj;
          }
        },
        jsPlugin()
      ];
      config.resolvers = [ jsResolver( config.resolve ) ];
      config.checkers = [ jsChecker() ];
      config.renderers = [ jsRenderer( Object.assign( { babelrc: false }, config.babelOpts ) ) ];
      config.cwd = fixturePath;
      config.watch = true;
      config._hideDates = true;
      config.watchOptions = {
        aggregateTimeout: 1
      };

      const assets = {};

      config.fs = {
        mkdirp: () => {},
        writeFile: ( file, content ) => {
          expect( path.isAbsolute( file ) ).toBe( true );

          assets[ path.relative( fixturePath, file ).replace( /\\/g, "/" ) ] = content;
        }
      };

      let output = "";

      const b = new Watcher( config );
      b.watcher = {
        _files: null,
        _dirs: null,
        watch( files, dirs ) {
          this._files = files;
          this._dirs = dirs;
        },
        close() {}
      };
      b.log = str => {
        output += str;
      };

      function update( file, type ) {
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

      b.start();
      b.nextJob( () => {
        setTimeout( next, 100 );
      } );

      await promise;

      expect( assets ).toMatchSnapshot();
      expect( output ).toMatchSnapshot();

    } );

  } );

} );
