import cli from "../src";

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
      cwd: __dirname,
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
      defaultConfigFile: "quase-cli-config.js"
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

    cli( ( { config, configLocation } ) => {
      expect( config.iAmTheConfigFile2 ).toBe( "yes" );
      expect( typeof configLocation ).toBe( "string" );
    }, {
      cwd: __dirname,
      pkg: {
        name: "@quase/eslint-config-quase",
        version: "0.0.1"
      },
      argv: [ "--config=quase-cli-config-2.js" ],
      help: "",
      defaultConfigFile: "quase-cli-config.js"
    }, false );

  } );

  it( "no config", () => {

    cli( ( { config, configLocation } ) => {
      expect( config ).toBe( undefined );
      expect( configLocation ).toBe( undefined );
    }, {
      cwd: __dirname,
      pkg: {
        name: "@quase/eslint-config-quase",
        version: "0.0.1"
      },
      argv: [],
      help: "",
      defaultConfigFile: "non-existent-file.js"
    }, false );

  } );

  it( "config key", () => {

    cli( ( { config, configLocation } ) => {
      expect( config.configFromPkg ).toBe( "yes" );
      expect( configLocation ).toBe( "pkg" );
    }, {
      cwd: __dirname,
      pkg: {
        name: "@quase/eslint-config-quase",
        version: "0.0.1"
      },
      argv: [ "" ],
      help: "",
      defaultConfigFile: "non-existent-file.js",
      configKey: "my-key"
    }, false );

  } );

  it( "config file has priority", () => {

    cli( ( { config, configLocation } ) => {
      expect( config.iAmTheConfigFile2 ).toBe( "yes" );
      expect( config.configFromPkg ).toBe( undefined );
      expect( typeof configLocation ).toBe( "string" );
      expect( configLocation ).not.toBe( "pkg" );
    }, {
      cwd: __dirname,
      pkg: {
        name: "@quase/eslint-config-quase",
        version: "0.0.1"
      },
      argv: [ "--config=quase-cli-config-2.js" ],
      help: "",
      defaultConfigFile: "quase-cli-config.js",
      configKey: "my-key"
    }, false );

  } );

} );
