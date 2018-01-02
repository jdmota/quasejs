import cli from "../src";

describe( "cli", () => {
  it( "basic", () => {

    /* eslint-disable no-console */

    process.stdout.isTTY = true;

    console.error = jest.fn();

    cli( ( { input, options, pkg, help, showHelp, config } ) => {
      expect( input[ 0 ] ).toBe( "foo" );
      expect( options.fooBar ).toBe( true );
      expect( options.boolean ).toBe( true );
      expect( options.boolean2 ).toBe( true );
      expect( options.number ).toBe( 10 );
      expect( options.meow ).toBe( "dog" );
      expect( options.unicorn ).toBe( "cat" );
      expect( options[ "--" ] ).toEqual( [ "unicorn", "10" ] );
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
      schema: {
        number: { default: 0 },
        unicorn: { alias: "u" },
        meow: { default: "dog" },
        boolean: { default: true },
        boolean2: { type: "boolean", default: true }
      },
      inferType: true,
      configFiles: "quase-cli-config.js",
      notifier: {
        options: {
          updateCheckInterval: 0
        },
        notify: {
          defer: false
        }
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
      configFiles: "quase-cli-config.js",
      notifier: false
    } );

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
      configFiles: "non-existent-file.js",
      notifier: false
    } );

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
      configFiles: "non-existent-file.js",
      configKey: "my-key",
      notifier: false
    } );

  } );

  it( "config file has priority", () => {

    cli( ( { options, configLocation } ) => {
      expect( options.iAmTheConfigFile2 ).toBe( "yes" );
      expect( options.configFromPkg ).toBe( undefined );
      expect( typeof configLocation ).toBe( "string" );
      expect( configLocation ).not.toBe( "pkg" );
    }, {
      cwd: __dirname,
      pkg: {
        name: "@quase/eslint-config-quase",
        version: "0.0.1"
      },
      schema: {
        iAmTheConfigFile2: {
          type: "string",
          default: "no"
        }
      },
      argv: [ "--config=quase-cli-config-2.js" ],
      help: "",
      configFiles: "quase-cli-config.js",
      configKey: "my-key",
      notifier: false
    } );

  } );

} );
