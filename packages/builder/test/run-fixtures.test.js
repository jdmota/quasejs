import Builder from "../src/builder";
import { relative } from "../src/id";
import transformConfig from "./transform-config";

function isRegExp( obj ) {
  return obj != null && typeof obj.test === "function";
}

/* eslint no-console: 0, no-new-func: 0 */

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

      jest.setTimeout( 20000 );

      let builder;
      let assetsNum = 0;
      const assets = {};
      const warnings = [];

      const fixturePath = path.resolve( FIXTURES, folder );

      let config = require( path.resolve( fixturePath, "config.js" ) );
      config.entries = config.entries || [ "index.js" ];
      config.context = config.context || "files";
      config.dest = config.dest || "atual";
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

      const expectedOut = config._out;
      delete config._out;

      const expectedError = config._error;
      delete config._error;

      const expectedWarn = config._warn;
      delete config._warn;

      config = transformConfig( config, fixturePath );

      builder = new Builder( config, w => {
        warnings.push( w );
      } );

      function success() {
        if ( expectedError ) {
          expect( "" ).toBe( expectedError );
        } else {
          expect( assets ).toMatchSnapshot();

          if ( expectedOut ) {
            config.entries.forEach( ( entry, i ) => {
              const dest = relative( path.resolve( builder.dest, entry ), builder.cwd );
              expect( typeof assets[ dest ] ).toBe( "string" );

              console.log = jest.fn();
              global.__quase_builder__ = undefined;
              new Function( assets[ dest ] )();

              expect(
                console.log.mock.calls.map( args => args.join( " " ) ).join( "\n" )
              ).toEqual( expectedOut[ i ] || "" );
            } );
          }
        }
        end();
      }

      function failure( err ) {
        if ( expectedOut || !expectedError ) {
          throw err;
        } else {
          if ( isRegExp( expectedError ) ) {
            if ( expectedError.test( err.message ) ) {
              expect( true ).toBe( true );
            } else {
              expect( err.stack ).toBe( expectedError );
            }
          } else {
            if ( err.message === expectedError ) {
              expect( err.message ).toBe( expectedError );
            } else {
              expect( err.stack ).toBe( expectedError );
            }
          }
          expect( assetsNum ).toBe( 0 );
        }
        end();
      }

      function end() {
        if ( expectedWarn ) {
          expect( warnings.join( "|" ) ).toBe( expectedWarn );
        } else {
          expect( warnings ).toHaveLength( 0 );
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
