import cli from "../src";

const { t } = require( "@quase/config" );

/* eslint-disable no-console */

describe( "cli", () => {
  it( "basic", () => {

    process.stdout.isTTY = true;

    console.error = jest.fn();

    cli( ( { input, options, pkg, help, showHelp, config } ) => {
      expect( input[ 0 ] ).toBe( "foo" );
      expect( options.fooBar ).toBe( true );
      expect( options.boolean ).toBe( true );
      expect( options.boolean2 ).toBe( true );
      expect( options.boolean3 ).toBe( false );
      expect( options.boolean4 ).toBe( false );
      expect( options.boolean5 ).toBe( true );
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
        version: "0.0.1",
        description: "Description"
      },
      argv: [ "foo", "--foo-bar", "--number", "10", "-u", "cat", "--boolean4=false", "--boolean5=true", "--", "unicorn", "10" ],
      help: `
        Usage
          foo <input>
      `,
      schema: {
        "--": { type: "array" },
        number: { default: 0 },
        unicorn: { alias: "u" },
        meow: { default: "dog" },
        boolean: { default: true },
        boolean2: { type: "boolean", default: true },
        boolean3: { type: "boolean" },
        boolean4: { type: "boolean" },
        boolean5: { type: "boolean" }
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

  it( "defaults", () => {

    cli( ( { options } ) => {
      expect( options ).toEqual( {
        foo: false,
        bar: {
          prop1: 0,
          prop2: 1
        },
        baz: {}
      } );
    }, {
      cwd: __dirname,
      pkg: {
        name: "@quase/eslint-config-quase",
        version: "0.0.1",
        description: "Description"
      },
      argv: [ "--bar.prop2=1" ],
      schema: {
        foo: {
          type: "boolean"
        },
        bar: {
          type: t.object( {
            prop1: {
              default: 0
            },
            prop2: {
              default: 0
            }
          } )
        },
        baz: {
          type: t.object( {
            prop1: {
              default: 0
            },
            prop2: {
              default: 0
            }
          } ),
          default: {}
        }
      },
      notifier: false
    } );

  } );

  it( "generate help", () => {

    cli( ( { help } ) => {
      expect( help ).toMatchSnapshot();
    }, {
      cwd: __dirname,
      pkg: {
        name: "@quase/eslint-config-quase",
        version: "0.0.1",
        description: "Description"
      },
      argv: [],
      usage: "$ bin something",
      schema: {
        number: { default: 0, alias: [ "n", "n2" ], description: "number description" },
        unicorn: { alias: "u", description: "unicorn description" },
        meow: { type: "string", default: "dog" },
        boolean: { type: "boolean", default: true, description: "boolean description" },
        object: {
          type: t.object( {
            prop: {
              type: "string"
            }
          } )
        },
        tuple: {
          type: t.tuple( [] ),
          description: "tuple"
        },
        array: {
          type: t.array( "string" ),
          description: "array of strings"
        },
        union: {
          type: t.union( [
            {
              type: "string"
            },
            {
              type: "number"
            }
          ] ),
          description: "union"
        }
      },
      notifier: false
    } );

  } );

  it( "inferType=true", () => {

    cli( ( { options, input } ) => {
      expect( options ).toEqual( {
        prop: 10
      } );
      expect( input ).toEqual( [ 10, "abc" ] );
    }, {
      cwd: __dirname,
      pkg: {
        name: "@quase/eslint-config-quase",
        version: "0.0.1"
      },
      argv: [ "--prop=10", "10", "abc" ],
      inferType: true,
      help: "",
      notifier: false
    } );

  } );

  it( "inferType=false", () => {

    cli( ( { options, input } ) => {
      expect( options ).toEqual( {
        prop: 10
      } );
      expect( input ).toEqual( [ "10", "abc" ] );
    }, {
      cwd: __dirname,
      pkg: {
        name: "@quase/eslint-config-quase",
        version: "0.0.1"
      },
      argv: [ "--prop=10", "10", "abc" ],
      help: "",
      notifier: false
    } );

  } );

  it( "alias", () => {

    cli( ( { options } ) => {
      expect( options ).toEqual( {
        aaa: true,
        foo: {
          bar: true
        }
      } );
    }, {
      cwd: __dirname,
      pkg: {
        name: "@quase/eslint-config-quase",
        version: "0.0.1"
      },
      argv: [ "-a", "-b" ],
      schema: {
        aaa: {
          type: "boolean",
          alias: "a"
        },
        foo: {
          argType: t.object( {
            bar: {
              type: "boolean",
              alias: "b"
            }
          } )
        }
      },
      help: "",
      notifier: false
    } );

  } );

  it( "dot notation", () => {

    cli( ( { options } ) => {
      expect( options ).toEqual( {
        obj: {
          foo: 10,
          bar: {
            baz: "dog",
            camelCase: "cat"
          }
        }
      } );
    }, {
      cwd: __dirname,
      pkg: {
        name: "@quase/eslint-config-quase",
        version: "0.0.1"
      },
      argv: [ "--obj.foo=10", "--obj.bar.baz=dog", "--obj.bar.camelCase=cat" ],
      help: "",
      notifier: false
    } );

  } );

  it( "coerce", () => {

    cli( ( { options } ) => {
      expect( options ).toEqual( {
        obj: {
          value: {
            foo: 10
          }
        }
      } );
    }, {
      cwd: __dirname,
      pkg: {
        name: "@quase/eslint-config-quase",
        version: "0.0.1"
      },
      argv: [ "--obj={\"foo\":10}" ],
      schema: {
        obj: {
          type: "object",
          coerce( value ) {
            return {
              value: JSON.parse( value )
            };
          }
        }
      },
      help: "",
      notifier: false
    } );

  } );

  it( "count", () => {

    cli( ( { options } ) => {
      expect( options ).toEqual( {
        v: 3
      } );
    }, {
      cwd: __dirname,
      pkg: {
        name: "@quase/eslint-config-quase",
        version: "0.0.1"
      },
      argv: [ "-vvv" ],
      schema: {
        v: {
          type: "number",
          argType: "count"
        }
      },
      help: "",
      notifier: false
    } );

  } );

  it( "narg", () => {

    cli( ( { options } ) => {
      expect( options ).toEqual( {
        aaa: "foo",
        foo: {
          bar: [ "bar", "baz" ]
        }
      } );
    }, {
      cwd: __dirname,
      pkg: {
        name: "@quase/eslint-config-quase",
        version: "0.0.1"
      },
      argv: [ "-a", "foo", "-b", "bar", "baz" ],
      schema: {
        aaa: {
          narg: 1,
          alias: "a"
        },
        foo: {
          argType: t.object( {
            bar: {
              narg: 2,
              alias: "b"
            }
          } )
        }
      },
      help: "",
      notifier: false
    } );

  } );

  it( "narg error", () => {

    expect( () => {
      cli( () => {}, {
        cwd: __dirname,
        pkg: {
          name: "@quase/eslint-config-quase",
          version: "0.0.1"
        },
        argv: [ "-a", "foo", "--foo.bar", "bar", "baz" ],
        schema: {
          aaa: {
            narg: 1,
            alias: "a"
          },
          foo: {
            argType: t.object( {
              bar: {
                narg: 5
              }
            } )
          }
        },
        help: "",
        notifier: false
      } );
    } ).toThrow( "Not enough arguments following: foo.bar" );

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

  it( "asked for config that does not exist", () => {

    expect( () => {
      cli( () => {}, {
        cwd: __dirname,
        pkg: {
          name: "@quase/eslint-config-quase",
          version: "0.0.1"
        },
        argv: [ "--config=non-existante-file.js" ],
        help: "",
        configFiles: [ "quase-cli-config.js" ],
        notifier: false
      } );
    } ).toThrow( /^Config file was not found/ );

  } );

} );
