import cli from "../src";

const { t } = require( "@quase/config" );

/* eslint-disable no-console */

describe( "cli", () => {
  it( "basic", async() => {

    process.stdout.isTTY = true;

    console.error = jest.fn();

    const { input, options, pkg, help, showHelp, config } = await cli( {
      validate: false,
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
        unicorn: { alias: "u", optional: true },
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
    expect( console.error.mock.calls ).toMatchSnapshot();

  } );

  it( "defaults", async() => {

    const { options } = await cli( {
      validate: false,
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

    expect( options ).toEqual( {
      foo: false,
      bar: {
        prop1: 0,
        prop2: 1
      },
      baz: {}
    } );

  } );

  it( "generate help", async() => {

    const { help } = await cli( {
      validate: false,
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
        unicorn: { alias: "u", optional: true, description: "unicorn description" },
        meow: { type: "string", default: "dog" },
        boolean: { type: "boolean", default: true, description: "boolean description" },
        object: {
          type: t.object( {
            prop: {
              type: "string",
              optional: true
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
            "string",
            "number"
          ] ),
          description: "union",
          optional: true
        },
        choices1: {
          choices: [ 0, 1, 2 ],
          description: "choices1",
          default: 0
        },
        choices2: {
          type: t.union( [ 0, 1, 2 ].map( t.value ) ),
          description: "choices2",
          default: 0
        },
        camelCase: {
          type: "string",
          description: "description",
          optional: true
        },
        noDescription: {
          description: "",
          optional: true
        }
      },
      notifier: false
    } );

    expect( help ).toMatchSnapshot();

  } );

  it( "inferType=true", async() => {

    const { options, input } = await cli( {
      validate: false,
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

    expect( options ).toEqual( {
      prop: 10
    } );
    expect( input ).toEqual( [ 10, "abc" ] );

  } );

  it( "inferType=false", async() => {

    const { options, input } = await cli( {
      validate: false,
      cwd: __dirname,
      pkg: {
        name: "@quase/eslint-config-quase",
        version: "0.0.1"
      },
      argv: [ "--prop=10", "10", "abc" ],
      help: "",
      notifier: false
    } );

    expect( options ).toEqual( {
      prop: 10
    } );
    expect( input ).toEqual( [ "10", "abc" ] );

  } );

  it( "alias", async() => {

    const { options } = await cli( {
      validate: false,
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
          optional: true,
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

    expect( options ).toEqual( {
      aaa: true,
      foo: {
        bar: true
      }
    } );

  } );

  it( "dot notation", async() => {

    const { options } = await cli( {
      validate: false,
      cwd: __dirname,
      pkg: {
        name: "@quase/eslint-config-quase",
        version: "0.0.1"
      },
      argv: [ "--obj.foo=10", "--obj.bar.baz=dog", "--obj.bar.camelCase=cat" ],
      help: "",
      notifier: false
    } );

    expect( options ).toEqual( {
      obj: {
        foo: 10,
        bar: {
          baz: "dog",
          camelCase: "cat"
        }
      }
    } );

  } );

  it( "coerce", async() => {

    const { options } = await cli( {
      validate: false,
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

    expect( options ).toEqual( {
      obj: {
        value: {
          foo: 10
        }
      }
    } );

  } );

  it( "count", async() => {

    const { options } = await cli( {
      validate: false,
      cwd: __dirname,
      pkg: {
        name: "@quase/eslint-config-quase",
        version: "0.0.1"
      },
      argv: [ "-vvv" ],
      schema: {
        v: {
          type: "number",
          argType: "count",
          optional: true
        }
      },
      help: "",
      notifier: false
    } );

    expect( options ).toEqual( {
      v: 3
    } );

  } );

  it( "narg", async() => {

    const { options } = await cli( {
      validate: false,
      cwd: __dirname,
      pkg: {
        name: "@quase/eslint-config-quase",
        version: "0.0.1"
      },
      argv: [ "-a", "foo", "-b", "bar", "baz" ],
      schema: {
        aaa: {
          optional: true,
          narg: 1,
          alias: "a"
        },
        foo: {
          optional: true,
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

    expect( options ).toEqual( {
      aaa: "foo",
      foo: {
        bar: [ "bar", "baz" ]
      }
    } );

  } );

  it( "narg error", async() => {

    await expect(
      cli( {
        validate: false,
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
      } )
    ).rejects.toThrow( "Not enough arguments following: foo.bar" );

  } );

  it( "config", async() => {

    const { config, configLocation } = await cli( {
      validate: false,
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

    expect( config.iAmTheConfigFile2 ).toBe( "yes" );
    expect( typeof configLocation ).toBe( "string" );

  } );

  it( "no config", async() => {

    const { config, configLocation } = await cli( {
      validate: false,
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

    expect( config ).toBe( undefined );
    expect( configLocation ).toBe( undefined );

  } );

  it( "config key", async() => {

    const { config, configLocation } = await cli( {
      validate: false,
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

    expect( config.configFromPkg ).toBe( "yes" );
    expect( configLocation ).toBe( "pkg" );

  } );

  it( "config file has priority", async() => {

    const { options, configLocation } = await cli( {
      validate: false,
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

    expect( options.iAmTheConfigFile2 ).toBe( "yes" );
    expect( options.configFromPkg ).toBe( undefined );
    expect( typeof configLocation ).toBe( "string" );
    expect( configLocation ).not.toBe( "pkg" );

  } );

  it( "asked for config that does not exist", async() => {

    await expect(
      cli( {
        validate: false,
        cwd: __dirname,
        pkg: {
          name: "@quase/eslint-config-quase",
          version: "0.0.1"
        },
        argv: [ "--config=non-existante-file.js" ],
        help: "",
        configFiles: [ "quase-cli-config.js" ],
        notifier: false
      } )
    ).rejects.toThrow( /^Config file was not found/ );

  } );

  it( "subcommands", async() => {

    const { command, input, options } = await cli( {
      validate: false,
      cwd: __dirname,
      pkg: {
        name: "@quase/eslint-config-quase",
        version: "0.0.1",
        description: "Description"
      },
      commands: {
        fooCommand: {
          schema: {
            foo: {
              type: "boolean"
            }
          }
        }
      },
      argv: [ "foo-command", "--foo" ],
      notifier: false
    } );

    expect( input ).toEqual( [] );
    expect( command ).toBe( "fooCommand" );
    expect( options.foo ).toBe( true );

  } );

  it( "invalid subcommand", async() => {

    await expect(
      cli( {
        cwd: __dirname,
        pkg: {
          name: "@quase/eslint-config-quase",
          version: "0.0.1",
          description: "Description"
        },
        commands: {
          fooCommand: {
            schema: {
              foo: {
                type: "boolean"
              }
            }
          }
        },
        argv: [ "bar-command", "--foo" ],
        notifier: false
      } )
    ).rejects.toThrow( /^"barCommand" is not a supported command$/ );

  } );

  it( "undefined subcommand", async() => {

    await expect(
      cli( {
        cwd: __dirname,
        pkg: {
          name: "@quase/eslint-config-quase",
          version: "0.0.1",
          description: "Description"
        },
        commands: {
          fooCommand: {
            schema: {
              foo: {
                type: "boolean"
              }
            }
          }
        },
        argv: [ "--foo" ],
        notifier: false
      } )
    ).rejects.toThrow( /^undefined is not a supported command$/ );

  } );

  it( "default subcommand", async() => {

    const { command, input, options } = await cli( {
      validate: false,
      cwd: __dirname,
      pkg: {
        name: "@quase/eslint-config-quase",
        version: "0.0.1",
        description: "Description"
      },
      defaultCommand: "fooCommand",
      commands: {
        fooCommand: {
          schema: {
            foo: {
              type: "boolean"
            }
          }
        }
      },
      argv: [ "--foo" ],
      notifier: false
    } );

    expect( input ).toEqual( [] );
    expect( command ).toBe( "fooCommand" );
    expect( options.foo ).toBe( true );

  } );

  it( "generate help with subcommands", async() => {

    const { help } = await cli( {
      validate: false,
      cwd: __dirname,
      pkg: {
        name: "@quase/eslint-config-quase",
        version: "0.0.1",
        description: "Description"
      },
      argv: [ "--help" ],
      usage: "$ bin <command> [options]",
      commands: {
        fooCommand: {
          description: "foo command description",
          schema: {
            number: { default: 0, alias: [ "n", "n2" ], description: "number description" }
          }
        },
        noDescription: {
          description: ""
        }
      },
      schema: {
        unicorn: { alias: "u", optional: true, description: "unicorn description" }
      },
      autoHelp: false,
      notifier: false
    } );

    expect( help ).toMatchSnapshot();

  } );

  it( "generate help with subcommands including options of default command", async() => {

    const { help } = await cli( {
      validate: false,
      cwd: __dirname,
      pkg: {
        name: "@quase/eslint-config-quase",
        version: "0.0.1",
        description: "Description"
      },
      argv: [ "--help" ],
      defaultCommand: "fooCommand",
      usage: "$ bin <command> [options]",
      commands: {
        fooCommand: {
          description: "foo command description",
          schema: {
            number: { default: 0, alias: [ "n", "n2" ], description: "number description" }
          }
        }
      },
      schema: {
        unicorn: { alias: "u", optional: true, description: "unicorn description" }
      },
      autoHelp: false,
      notifier: false
    } );

    expect( help ).toMatchSnapshot();

  } );

  it( "generate help for subcommand", async() => {

    const { help } = await cli( {
      validate: false,
      cwd: __dirname,
      pkg: {
        name: "@quase/eslint-config-quase",
        version: "0.0.1",
        description: "Description"
      },
      argv: [ "fooCommand" ],
      usage: "$ bin <command> [options]",
      commands: {
        fooCommand: {
          description: "foo command description",
          schema: {
            number: { default: 0, alias: [ "n", "n2" ], description: "number description" },
            unicorn: { alias: "u", optional: true, description: "unicorn description" },
            meow: { type: "string", default: "dog" },
            boolean: { type: "boolean", default: true, description: "boolean description" },
          }
        }
      },
      schema: {},
      notifier: false
    } );

    expect( help ).toMatchSnapshot();

  } );

} );
