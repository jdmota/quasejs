import { relative } from "../dist/utils/path";
import { formatError } from "../dist/utils/error";
import Builder from "../dist/builder";
import transformConfig from "./transform-config";

const stripAnsi = require( "strip-ansi" );
const fs = require( "fs-extra" );
const path = require( "path" );

/* eslint no-console: 0, no-new-func: 0 */

describe( "builder", () => {

  const FIXTURES = path.resolve( "packages/builder/test/fixtures" );
  const folders = fs.readdirSync( FIXTURES );

  folders.forEach( folder => {

    if ( folder === "__dev__" ) {
      return;
    }

    it( `Fixture: ${folder}`, async() => {

      jest.setTimeout( 120000 );

      let builder;
      let assetsNum = 0;
      const assets = {};
      const warnings = [];

      const fixturePath = path.resolve( FIXTURES, folder );

      let config;
      try {
        config = require( path.resolve( fixturePath, "config.js" ) );
      } catch ( err ) {
        config = {};
      }

      config.entries = config.entries || [ "index.js" ];
      config.context = config.context || "files";
      config.dest = config.dest || "atual";
      config.fs = {
        mkdirp: () => {},
        writeFile: ( file, content ) => {
          expect( path.isAbsolute( file ) ).toBe( true );

          const f = relative( file, builder.options.cwd );
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

      builder = new Builder( config );
      builder.on( "warning", w => {
        warnings.push( w );
      } );

      function success() {
        if ( expectedError ) {
          expect( "" ).toBe( expectedError );
        } else {
          expect( assets ).toMatchSnapshot();

          if ( expectedOut ) {
            config.entries.forEach( ( entry, i ) => {
              const dest = relative( path.resolve( builder.options.dest, entry ), builder.options.cwd );
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
          const { message, stack } = formatError( err );
          expect(
            stripAnsi( `${message}${stack && err.codeFrame ? `\n${stack}` : ""}` )
              .replace( process.cwd() + path.sep, "" )
          ).toMatchSnapshot( "error" );
          expect( assetsNum ).toBe( 0 );
        }
        end();
      }

      function end() {
        if ( expectedWarn ) {
          expect( warnings.join( "|" ) ).toMatchSnapshot( "warnings" );
        } else {
          expect( warnings ).toHaveLength( 0 );
        }
      }

      try {
        await builder.runBuild();
      } catch ( err ) {
        return failure( err );
      } finally {
        builder.stop();
      }

      return success();
    } );
  } );

} );
