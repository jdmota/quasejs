import builder from "../src";
import { testLog } from "../../assert";

function isRegExp( obj ) {
  return obj != null && typeof obj.test === "function";
}

describe( "builder", () => {

  const fs = require( "fs-extra" );
  const path = require( "path" );

  const FIXTURES = path.resolve( "packages/builder/test/fixtures" );
  const folders = fs.readdirSync( FIXTURES );

  folders.forEach( folder => {
    it( `Fixture: ${folder}`, async() => {

      let assetsNum = 0;
      const assets = {};
      const warnings = [];

      const fixturePath = path.resolve( FIXTURES, folder );
      const config = require( path.resolve( fixturePath, "config.js" ) );

      expect( config ).not.toBe( null );

      config.cwd = fixturePath;
      config.onwarn = w => {
        warnings.push( w );
      };
      config.fs = {
        mkdirp: () => {},
        writeFile: ( file, content ) => {
          const f = path.relative( fixturePath, file ).replace( /\\/g, "/" );
          if ( assets[ f ] ) {
            throw new Error( `Overriding ${f}` );
          }
          assets[ f ] = content;
        }
      };

      function success() {
        if ( config._error ) {
          expect( "" ).toBe( config._error );
        } else {
          expect( assets ).toMatchSnapshot();

          if ( config._out ) {
            config.entries.forEach( ( [ , dest ], i ) => {
              testLog( () => {
                expect( typeof assets[ dest ] ).toBe( "string" );
                new Function( assets[ dest ] )(); // eslint-disable-line no-new-func
              }, config._out[ i ] );
            } );
          }
        }
        end();
      }

      function failure( err ) {
        if ( config._out ) {
          throw err;
        } else {
          if ( isRegExp( config._error ) ) {
            expect( config._error.test( err.message ) ).toBe( true );
          } else {
            expect( err.message ).toBe( config._error );
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
        await builder( config );
      } catch ( err ) {
        return failure( err );
      }

      return success();
    } );
  } );

} );
