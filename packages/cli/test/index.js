import cli from "../src";

const path = require( "path" );

describe( "cli", () => {
  it( "basic", () => {

    /* eslint-disable no-console */

    process.stdout.isTTY = true;

    console.error = jest.fn();

    cli( ( { input, flags, pkg, help, showHelp, config } ) => {
      expect( input[ 0 ] ).toBe( "foo" );
      expect( flags.fooBar ).toBe( true );
      expect( flags.number ).toBe( 10 );
      expect( flags.meow ).toBe( "dog" );
      expect( flags.unicorn ).toBe( "cat" );
      expect( flags[ "--" ] ).toEqual( [ "unicorn", "10" ] );
      expect( pkg.name ).toBe( "@quase/eslint-config-quase" );
      expect( pkg.version ).toBe( "0.0.1" );
      expect( help ).toMatchSnapshot();
      expect( typeof showHelp ).toBe( "function" );
      expect( config.iAmTheConfigFile ).toBe( "yes" );
    }, {
      pkg: {
        name: "@quase/eslint-config-quase",
        version: "0.0.1"
      },
      argv: [ "foo", "--foo-bar", "--number", "10", "-u", "cat", "--", "unicorn", "10" ],
      help: `
        Usage
          foo <input>
      `,
      flags: {
        number: { default: 0 },
        unicorn: { alias: "u" },
        meow: { default: "dog" },
        "--": true
      },
      inferType: true,
      defaultConfigFile: path.resolve( __dirname, "quase-cli-config.js" )
    }, {
      options: {
        updateCheckInterval: 0
      },
      notify: {
        defer: false
      }
    } );

    expect( console.error.mock.calls ).toMatchSnapshot();

  } );

  it( "config", () => {

    cli( ( { config } ) => {
      expect( config.iAmTheConfigFile ).toBe( "yes" );
    }, {
      pkg: {
        name: "@quase/eslint-config-quase",
        version: "0.0.1"
      },
      argv: [ `--config=${path.resolve( __dirname, "quase-cli-config.js" )}` ],
      help: "",
      defaultConfigFile: path.resolve( __dirname, "quase-cli-config.js" )
    }, false );

  } );

  it( "empty config", () => {

    cli( ( { config } ) => {
      expect( config.iAmTheConfigFile ).toBe( undefined );
    }, {
      pkg: {
        name: "@quase/eslint-config-quase",
        version: "0.0.1"
      },
      argv: [ "--config=none" ],
      help: "",
      defaultConfigFile: path.resolve( __dirname, "quase-cli-config.js" )
    }, false );

  } );

} );
