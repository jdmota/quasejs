import Builder from "../src/builder";
import { relative } from "../src/id";
import { testLog } from "../../assert";
import transformConfig from "./transform-config";

function isRegExp( obj ) {
  return obj != null && typeof obj.test === "function";
}

describe( "builder", () => {

  const fs = require( "fs-extra" );
  const path = require( "path" );

  const FIXTURES = path.resolve( "packages/builder/test/fixtures" );
  const folders = fs.readdirSync( FIXTURES );

  folders.forEach( folder => {

    if ( folder === "__dev__" ) {
      return;
    }

    it( `Fixture: ${folder}`, async() => {

      let builder;
      let assetsNum = 0;
      const assets = {};
      const warnings = [];

      const fixturePath = path.resolve( FIXTURES, folder );
      const config = transformConfig( require( path.resolve( fixturePath, "config.js" ) ), fixturePath );

      config.entries = config.entries || [ "index.js" ];
      config.context = config.context || "files";
      config.dest = config.dest || "atual";
      config.warn = w => {
        warnings.push( w );
      };
      config.fs = {
        mkdirp: () => {},
        writeFile: ( file, content ) => {
          expect( path.isAbsolute( file ) ).toBe( true );

          const f = relative( file, builder.cwd );
          if ( assets[ f ] ) {
            throw new Error( `Overriding ${f}` );
          }
          assets[ f ] = content;
        }
      };

      builder = new Builder( config );

      function success() {
        if ( config._error ) {
          expect( "" ).toBe( config._error );
        } else {
          expect( assets ).toMatchSnapshot();

          if ( config._out ) {
            config.entries.forEach( ( entry, i ) => {
              const dest = relative( path.resolve( builder.dest, entry ), builder.cwd );
              testLog( () => {
                expect( typeof assets[ dest ] ).toBe( "string" );
                global.__quase_builder__ = undefined;
                new Function( assets[ dest ] )(); // eslint-disable-line no-new-func
              }, config._out[ i ] );
            } );
          }
        }
        end();
      }

      function failure( err ) {
        if ( config._out || !config._error ) {
          throw err;
        } else {
          if ( isRegExp( config._error ) ) {
            if ( config._error.test( err.message ) ) {
              expect( true ).toBe( true );
            } else {
              expect( err.stack ).toBe( config._error );
            }
          } else {
            if ( err.message === config._error ) {
              expect( err.message ).toBe( config._error );
            } else {
              expect( err.stack ).toBe( config._error );
            }
          }
          expect( assetsNum ).toBe( 0 );
        }
        end();
      }

      function end() {
        if ( config._warn ) {
          expect( warnings.join( "|" ) ).toBe( config._warn );
        } else {
          expect( warnings.length ).toBe( 0 );
        }
      }

      try {
        await builder.build();
      } catch ( err ) {
        return failure( err );
      }

      return success();
    } );
  } );

} );
