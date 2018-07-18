import cli from "../src";

const { t } = require( "@quase/config" ); // eslint-disable-line node/no-extraneous-require

/* eslint-disable no-console */

describe( "cli", () => {
  it( "basic", async() => {

    process.stdout.isTTY = true;

    console.error = jest.fn();

    const { input, options, pkg, generateHelp, showHelp, config } = await cli( {
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
        "--": { type: "array", itemType: "string" },
        number: { type: "number", default: 0 },
        unicorn: { type: "string", alias: "u", optional: true },
        meow: { type: "any", default: "dog" },
        boolean: { type: "boolean", default: true },
        boolean2: { type: "boolean", default: true },
        boolean3: { type: "boolean" },
        boolean4: { type: "boolean" },
        boolean5: { type: "boolean" },
        iAmTheConfigFile: { type: "string", optional: true },
        fooBar: { type: "boolean" }
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
    expect( generateHelp() ).toMatchSnapshot();
    expect( typeof showHelp ).toBe( "function" );
    expect( config.iAmTheConfigFile ).toBe( "yes" );
    expect( console.error.mock.calls ).toMatchSnapshot();

  } );

  it( "defaults", async() => {

    const { options } = await cli( {
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
        bar: t.object( {
          properties: {
            prop1: {
              type: "number",
              default: 0
            },
            prop2: {
              type: "number",
              default: 0
            }
          }
        } ),
        baz: t.object( {
          properties: {
            prop1: {
              type: "number",
              default: 0
            },
            prop2: {
              type: "number",
              default: 0
            }
          }
        } )
      },
      notifier: false
    } );

    expect( options ).toEqual( {
      foo: false,
      bar: {
        prop1: 0,
        prop2: 1
      },
      baz: {
        prop1: 0,
        prop2: 0
      }
    } );

  } );

  it( "generate help", async() => {

    const { generateHelp } = await cli( {
      cwd: __dirname,
      pkg: {
        name: "@quase/eslint-config-quase",
        version: "0.0.1",
        description: "Description"
      },
      argv: [],
      usage: "$ bin something",
      schema: {
        number: { type: "number", default: 0, alias: [ "n", "n2" ], description: "number description" },
        unicorn: { type: "string", alias: "u", optional: true, description: "unicorn description" },
        meow: { type: "string", description: "", default: "dog" },
        boolean: { type: "boolean", default: false, description: "boolean description" },
        booleanNo: { type: "boolean", default: true, description: "boolean no description" },
        object: t.object( {
          properties: {
            prop: {
              type: "string",
              description: "",
              optional: true
            }
          },
          description: ""
        } ),
        tuple: t.tuple( {
          items: [],
          description: "tuple"
        } ),
        array: t.array( {
          itemType: "string",
          description: "array of strings"
        } ),
        union: t.union( {
          types: [
            "string",
            "number",
            t.tuple( {
              items: [
                {
                  type: "string",
                  description: "",
                }
              ]
            } )
          ],
          description: "union",
          optional: true
        } ),
        choices1: t.choices( {
          values: [ 0, 1, 2 ],
          description: "choices1",
          default: 0
        } ),
        choices2: t.union( {
          types: [ 0, 1, 2 ].map( x => t.value( { value: x } ) ),
          description: "choices2",
          default: 0
        } ),
        camelCase: {
          type: "string",
          description: "description",
          optional: true
        },
        noDescription: {
          type: "any",
          description: "",
          optional: true
        }
      },
      notifier: false
    } );

    expect( generateHelp() ).toMatchSnapshot();

  } );

  it( "inferType=true", async() => {

    const { options, input } = await cli( {
      cwd: __dirname,
      pkg: {
        name: "@quase/eslint-config-quase",
        version: "0.0.1"
      },
      argv: [ "--prop=10", "10", "abc" ],
      inferType: true,
      help: "",
      notifier: false,
      schema: {
        prop: {
          type: "any",
          optional: true
        }
      }
    } );

    expect( options ).toEqual( {
      prop: 10
    } );
    expect( input ).toEqual( [ 10, "abc" ] );

  } );

  it( "inferType=false", async() => {

    const { options, input } = await cli( {
      cwd: __dirname,
      pkg: {
        name: "@quase/eslint-config-quase",
        version: "0.0.1"
      },
      argv: [ "--prop=10", "10", "abc" ],
      help: "",
      notifier: false,
      schema: {
        prop: {
          type: "any",
          optional: true
        }
      }
    } );

    expect( options ).toEqual( {
      prop: 10
    } );
    expect( input ).toEqual( [ "10", "abc" ] );

  } );

  it( "dont set default value on flags", async() => {

    const { flags } = await cli( {
      cwd: __dirname,
      pkg: {
        name: "@quase/eslint-config-quase",
        version: "0.0.1"
      },
      argv: [ "" ],
      schema: {
        array: {
          type: "array"
        },
        string: {
          type: "string",
          optional: true
        },
        number: {
          type: "number",
          optional: true
        },
        boolean: {
          type: "boolean"
        },
        union: t.union( {
          types: [ "boolean", "array" ],
          optional: true
        } )
      },
      help: "",
      notifier: false
    } );

    expect( flags ).toEqual( {} );

  } );

  it( "alias", async() => {

    const { options } = await cli( {
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
        foo: t.object( {
          properties: {
            bar: {
              type: "boolean",
              alias: "b"
            }
          },
          optional: true,
        } )
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
      cwd: __dirname,
      pkg: {
        name: "@quase/eslint-config-quase",
        version: "0.0.1"
      },
      argv: [ "--obj.foo=10", "--obj.bar.baz=dog", "--obj.bar.camel-case=cat", "--no-obj.bool" ],
      help: "",
      notifier: false,
      schema: {
        obj: t.object( {
          properties: {
            foo: {
              type: "number",
              default: 0
            },
            bool: {
              type: "boolean"
            },
            bar: t.object( {
              properties: {
                baz: {
                  type: "string",
                  optional: true
                },
                camelCase: {
                  type: "string",
                  optional: true
                }
              }
            } )
          }
        } )
      }
    } );

    expect( options ).toEqual( {
      obj: {
        foo: 10,
        bool: false,
        bar: {
          baz: "dog",
          camelCase: "cat"
        }
      }
    } );

  } );

  it( "coerce", async() => {

    const { options } = await cli( {
      cwd: __dirname,
      pkg: {
        name: "@quase/eslint-config-quase",
        version: "0.0.1"
      },
      argv: [ "--obj={\"foo\":10}" ],
      schema: {
        obj: {
          type: "object",
          additionalProperties: true,
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
      cwd: __dirname,
      pkg: {
        name: "@quase/eslint-config-quase",
        version: "0.0.1"
      },
      argv: [ "-a", "foo", "-b", "bar", "baz" ],
      schema: {
        aaa: t.array( {
          itemType: "string",
          optional: true,
          narg: 1,
          alias: "a"
        } ),
        foo: t.object( {
          properties: {
            bar: t.array( {
              itemType: "string",
              narg: 2,
              alias: "b"
            } )
          },
          optional: true
        } )
      },
      help: "",
      notifier: false
    } );

    expect( options ).toEqual( {
      aaa: [ "foo" ],
      foo: {
        bar: [ "bar", "baz" ]
      }
    } );

  } );

  it( "narg error", async() => {

    await expect(
      cli( {
        cwd: __dirname,
        pkg: {
          name: "@quase/eslint-config-quase",
          version: "0.0.1"
        },
        argv: [ "-a", "foo", "--foo.bar", "bar", "baz" ],
        schema: {
          aaa: {
            type: "any",
            narg: 1,
            alias: "a"
          },
          foo: t.object( {
            properties: {
              bar: {
                type: "any",
                narg: 5
              }
            }
          } )
        },
        help: "",
        notifier: false
      } )
    ).rejects.toThrow( "Not enough arguments following: foo.bar" );

  } );

  it( "config", async() => {

    const { options, config, configLocation } = await cli( {
      cwd: __dirname,
      pkg: {
        name: "@quase/eslint-config-quase",
        version: "0.0.1"
      },
      argv: [ "--config=quase-cli-config-2.js" ],
      help: "",
      schema: {
        iAmTheConfigFile2: {
          type: "string",
          optional: true
        }
      },
      configFiles: "quase-cli-config.js",
      notifier: false
    } );

    expect( options.config ).toBe( undefined );
    expect( options.c ).toBe( undefined );
    expect( config.iAmTheConfigFile2 ).toBe( "yes" );
    expect( typeof configLocation ).toBe( "string" );

  } );

  it( "no config", async() => {

    const { config, configLocation } = await cli( {
      cwd: __dirname,
      pkg: {
        name: "@quase/eslint-config-quase",
        version: "0.0.1"
      },
      argv: [],
      help: "",
      schema: {},
      configFiles: "non-existent-file.js",
      notifier: false
    } );

    expect( config ).toBe( undefined );
    expect( configLocation ).toBe( undefined );

  } );

  it( "config key", async() => {

    const { config, configLocation } = await cli( {
      cwd: __dirname,
      pkg: {
        name: "@quase/eslint-config-quase",
        version: "0.0.1"
      },
      argv: [ "" ],
      help: "",
      schema: {
        configFromPkg: {
          type: "string",
          optional: true
        }
      },
      configFiles: "non-existent-file.js",
      configKey: "my-key",
      notifier: false
    } );

    expect( config.configFromPkg ).toBe( "yes" );
    expect( configLocation ).toBe( "pkg" );

  } );

  it( "config file has priority", async() => {

    const { options, configLocation } = await cli( {
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
        cwd: __dirname,
        pkg: {
          name: "@quase/eslint-config-quase",
          version: "0.0.1"
        },
        argv: [ "--config=non-existante-file.js" ],
        help: "",
        schema: {},
        configFiles: [ "quase-cli-config.js" ],
        notifier: false
      } )
    ).rejects.toThrow( /^Config file was not found/ );

  } );

  it( "subcommands", async() => {

    const { command, input, options } = await cli( {
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

  it( "required subcommand", async() => {

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
    ).rejects.toThrow( "Command required. E.g. fooCommand" );

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

  it( "default subcommand", async() => {

    const { command, input, options } = await cli( {
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

    const { generateHelp } = await cli( {
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
            number: { type: "number", default: 0, alias: [ "n", "n2" ], description: "number description" },
            help: { type: "boolean" }
          }
        },
        noDescription: {
          description: ""
        }
      },
      schema: {
        unicorn: { type: "string", alias: "u", optional: true, description: "unicorn description" },
        help: { type: "boolean" }
      },
      autoHelp: false,
      notifier: false
    } );

    expect( generateHelp() ).toMatchSnapshot();

  } );

  it( "generate help with subcommands including options of default command", async() => {

    const { generateHelp } = await cli( {
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
            number: { type: "number", default: 0, alias: [ "n", "n2" ], description: "number description" },
            help: { type: "boolean" }
          }
        }
      },
      schema: {
        unicorn: { type: "string", alias: "u", optional: true, description: "unicorn description" },
        help: { type: "boolean" }
      },
      autoHelp: false,
      notifier: false
    } );

    expect( generateHelp() ).toMatchSnapshot();

  } );

  it( "generate help for subcommand", async() => {

    const { generateHelp } = await cli( {
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
            number: { type: "number", default: 0, alias: [ "n", "n2" ], description: "number description" },
            unicorn: { type: "string", alias: "u", optional: true, description: "unicorn description" },
            meow: { type: "string", default: "dog" },
            boolean: { type: "boolean", default: true, description: "boolean description" },
          }
        }
      },
      schema: {},
      notifier: false
    } );

    expect( generateHelp() ).toMatchSnapshot();

  } );

  it( "accept help for subcommand", async() => {

    const { generateHelp } = await cli( {
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
          help: "Custom subcommand help",
          schema: {
            number: { type: "number", default: 0, alias: [ "n", "n2" ], description: "number description" },
            unicorn: { type: "string", alias: "u", optional: true, description: "unicorn description" },
            meow: { type: "string", default: "dog" },
            boolean: { type: "boolean", default: true, description: "boolean description" },
          }
        }
      },
      schema: {},
      notifier: false
    } );

    expect( generateHelp() ).toMatchSnapshot();

  } );

} );
