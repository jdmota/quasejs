import { cli } from "../src";

/* eslint-disable no-console */

describe( "cli", () => {
  it( "basic", async() => {

    process.stdout.isTTY = true;

    console.error = jest.fn();

    const { input, options, flags, pkg, generateHelp, showHelp, config } = await cli( {
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
      "populate--": true,
      inferType: true,
      schema: `type Schema {
        number: number @default(0);
        unicorn: string? @alias("u");
        meow: any @default("dog");
        boolean: boolean @default(true);
        boolean2: boolean @default(true);
        boolean3: boolean @default(false);
        boolean4: boolean @default(false);
        boolean5: boolean @default(false);
        iAmTheConfigFile: string?;
        fooBar: boolean @default(false);
      }`,
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
    expect( flags[ "--" ] ).toEqual( [ "unicorn", "10" ] );
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
      schema: `type Schema {
        foo: boolean @default(false);
        bar: type {
          prop1: number @default(0);
          prop2: number @default(0);
        };
        baz: type {
          prop1: number @default(0);
          prop2: number @default(0);
        };
      }`,
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

  it( "boolean interpretation", async() => {

    const { options } = await cli( {
      cwd: __dirname,
      pkg: {
        name: "@quase/eslint-config-quase",
        version: "0.0.1"
      },
      argv: [ "--foo=true", "--bar", "--baz=false", "--other=abc" ],
      schema: `
      type Type = boolean? | string;
      type Schema {
        foo: Type;
        bar: Type;
        baz: Type;
        other: Type;
      }`,
      notifier: false
    } );

    expect( options ).toEqual( {
      foo: true,
      bar: true,
      baz: false,
      other: "abc"
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
      "populate--": true,
      schema: `type Schema {
        number: number @default(0) @alias("n","n2") @description("number description");
        unicorn: string? @alias("u") @description("unicorn description");
        meow: string @default("dog") @description("");
        boolean: boolean @default(false) @description("boolean description");
        booleanNo: boolean @default(true) @description("boolean no description");
        object: type @description("") {
          prop: string? @description("");
        };
        tuple: [ string? ] @description("");
        array: string[] @description("array of strings");
        union: string? | number | [ string ] @description("union") @default("");
        choices: 0 | 1 | 2 @default(0) @description("choices");
        camelCase: string? @description("description");
        noDescription: any;
      }`,
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
      schema: `type Schema {
        prop: any;
      }`
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
      schema: `type Schema {
        prop: any;
      }`
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
      schema: `type Schema {
        array: any[];
        string: string?;
        number: number?;
        boolean: boolean?;
      }`,
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
      schema: `type Schema {
        aaa: boolean @alias("a");
        foo: type {
          bar: boolean @alias("b");
        };
      }`,
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
      schema: `type Schema {
        obj: type {
          foo: number @default(0);
          bool: boolean @default(false);
          bar: type {
            baz: string?;
            camelCase: string?;
          };
        };
      }`
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
      schema: `type Schema {
        obj: type @additionalProperties @coerce(js(v=>({value:JSON.parse(v)}))) {};
      }`,
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
      schema: `type Schema {
        v: number? @count;
      }`,
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
      schema: `type Schema {
        aaa: string[] @narg(1) @alias("a");
        foo: type {
          bar: string[] @narg(2) @alias("b");
        };
      }`,
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
        schema: `type Schema {
          aaa: any @narg(1) @alias("a");
          foo: type {
            bar: any @narg(5);
          };
        }`,
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
      schema: `type Schema {
        iAmTheConfigFile2: string?;
      }`,
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
      schema: `type Schema {}`,
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
      schema: `type Schema {
        configFromPkg: string?;
      }`,
      configFiles: "non-existent-file.js",
      configKey: "my-key",
      notifier: false
    } );

    expect( config.configFromPkg ).toBe( "yes" );
    expect( configLocation.endsWith( "package.json" ) ).toBe( true );

  } );

  it( "config file has priority", async() => {

    const { options, configLocation } = await cli( {
      cwd: __dirname,
      pkg: {
        name: "@quase/eslint-config-quase",
        version: "0.0.1"
      },
      schema: `type Schema {
        iAmTheConfigFile2: string @default("no");
      }`,
      argv: [ "--config=quase-cli-config-2.js" ],
      help: "",
      configFiles: "quase-cli-config.js",
      configKey: "my-key",
      notifier: false
    } );

    expect( options.iAmTheConfigFile2 ).toBe( "yes" );
    expect( options.configFromPkg ).toBe( undefined );
    expect( typeof configLocation ).toBe( "string" );
    expect( configLocation.endsWith( "package.json" ) ).toBe( false );

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
        schema: `type Schema {}`,
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
          schema: `type Schema {
            foo: boolean;
          }`
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
            schema: `type Schema {
              foo: boolean;
            }`
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
            schema: `type Schema {
              foo: boolean;
            }`
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
          schema: `type Schema {
            foo: boolean;
          }`
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
          schema: `type Schema {
            number: number @default(0) @alias("n","n2") @description("number description");
          }`
        },
        noDescription: {
          description: ""
        }
      },
      schema: `type Schema {
        unicorn: string? @alias("u") @description("unicorn description");
      }`,
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
          schema: `type Schema {
            number: number @default(0) @alias("n","n2") @description("number description");
          }`
        }
      },
      schema: `type Schema {
        unicorn: string? @alias("u") @description("unicorn description");
      }`,
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
          schema: `type Schema {
            number: number @default(0) @alias("n","n2") @description("number description");
            unicorn: string? @alias("u") @description("unicorn description");
            meow: string @default("dog");
            boolean: boolean @default(true) @description("boolean description");
          }`
        }
      },
      schema: `type Schema {}`,
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
          schema: `type Schema {
            number: number @default(0) @alias("n","n2") @description("number description");
            unicorn: string? @alias("u") @description("unicorn description");
            meow: string @default("dog");
            boolean: boolean @default(true) @description("boolean description");
          }`
        }
      },
      schema: `type Schema {}`,
      notifier: false
    } );

    expect( generateHelp() ).toMatchSnapshot();

  } );

} );
