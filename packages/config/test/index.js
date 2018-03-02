import { t, validate, printError, applyDefaults, getConfig } from "../src";

const stripAnsi = require( "strip-ansi" );

/* eslint no-console: 0 */

function v( options, schema ) {
  const mock = jest.fn();
  console.error = mock;
  console.warn = mock;
  try {
    validate( schema, options );
    mock( "OK" );
  } catch ( e ) {
    printError( e );
  }
  expect(
    mock.mock.calls.map( x => {
      if ( Array.isArray( x ) ) {
        return x.map( stripAnsi );
      }
      return stripAnsi( x );
    } )
  ).toMatchSnapshot();
}

it( "validate", () => {

  v( {
    deprecated: true
  }, {
    deprecated: {
      deprecated: true
    }
  } );

  v( {
    config: true
  }, {
    config: {
      type: "string"
    }
  } );

  v( {
    obj: {
      foo: {
        bar: 10
      }
    }
  }, {
    obj: {
      type: t.object( {
        foo: {
          type: t.object( {
            bar: {
              type: "string",
              example: "example"
            }
          } )
        }
      } )
    }
  } );

  v( {
    obj: {
      foo: 10
    }
  }, {
    obj: {
      type: t.object( {
        foo: {
          type: t.object( {
            bar: {
              type: "string",
              example: "example"
            }
          } )
        }
      } )
    }
  } );

  v( {
    obj: {
      foo: {
        baz: "abc"
      }
    }
  }, {
    obj: {
      type: t.object( {
        foo: {
          type: t.object( {
            bar: {
              type: "string",
              example: "example"
            }
          } )
        }
      } )
    }
  } );

  v( {
    obj: {
      foo: [ "string", 10 ]
    }
  }, {
    obj: {
      type: t.object( {
        foo: {
          type: t.tuple( [
            {
              type: "string",
              example: "example"
            }, {
              type: "string",
              example: "example"
            }
          ] )
        }
      } )
    }
  } );

  v( {
    obj: {
      foo: {}
    }
  }, {
    obj: {
      type: t.object( {
        foo: {
          type: t.tuple( [
            {
              type: "string",
              example: "example"
            }, {
              type: "string",
              example: "example"
            }
          ] )
        }
      } )
    }
  } );

  v( {
    obj: {
      foo: [ "string", 10 ]
    }
  }, {
    obj: {
      type: t.object( {
        foo: {
          type: t.union( [
            "string",
            "number"
          ] ),
          example: "example"
        }
      } )
    }
  } );

  v( {
    obj: {
      foo: 2
    }
  }, {
    obj: {
      type: t.object( {
        foo: {
          choices: [
            0,
            1
          ],
          example: 1
        }
      } )
    }
  } );

  v( {
    required: undefined
  }, {
    required: {
      type: "boolean",
      required: true
    }
  } );

  v( {
    optional: undefined
  }, {
    optional: {
      type: "boolean",
      optional: true
    }
  } );

  v( {
    required: undefined
  }, {
    required: {
      type: "boolean"
    }
  } );

  v( {
    obj: {
      foo: 2
    }
  }, {
    obj: {
      type: t.object( {
        foo: {
          type: t.union(
            [ 0, 1, "object" ].map( t.value )
          ),
          example: 1
        }
      } )
    }
  } );

  v( {
    obj: {
      foo: 2
    }
  }, {
    obj: {
      type: t.object( {
        foo: {
          type: t.union(
            [ t.value( 0 ), t.value( 1 ), "object" ]
          ),
          example: 1
        }
      } )
    }
  } );

  v( {
    obj: {
      foo: 0
    }
  }, {
    obj: {
      type: t.object( {
        foo: {
          type: t.union(
            [ t.value( 0 ), t.value( 1 ), "object" ]
          ),
          example: 1
        }
      } )
    }
  } );

} );

function d( schema, ...args ) {
  try {
    expect( applyDefaults( schema, ...args ) ).toMatchSnapshot();
  } catch ( err ) {
    expect( stripAnsi( err.message ) ).toMatchSnapshot();
  }
}

it( "apply defaults", () => {

  d( {
    obj: {
      type: t.object( {
        foo: {
          type: t.tuple( [
            {
              type: "string",
              default: "a"
            }, {
              type: "string",
              default: "b"
            }
          ] )
        }
      } )
    }
  }, {
    obj: {
      foo: []
    }
  } );

  d( {
    obj: {
      type: t.object( {
        foo: {
          type: t.object( {
            a: {
              default: 10
            },
            b: {
              default: 20
            }
          } )
        }
      } )
    }
  }, {
    obj: {}
  } );

  d( {
    obj: {
      type: t.object( {
        foo: {
          type: t.object( {
            a: {
              default: 10
            },
            b: {
              default: 20
            }
          } )
        }
      } )
    }
  }, {
    obj: {
      foo: 100
    }
  } );

  d( {
    obj: {
      type: "boolean"
    }
  } );

  d( {
    obj: {
      type: "array"
    }
  } );

  d( {
    obj: {
      type: "object"
    }
  } );

  d( {
    obj: {
      type: "number",
      optional: true
    }
  } );

  d( {
    obj: {
      type: "number",
      default: 0
    }
  } );

  d( {
    obj: {
      type: "number"
    }
  } );

  d( {
    obj: {
      type: "number",
      default: 0
    }
  }, undefined, null );

} );

it( "apply defaults - merge modes", () => {

  d( {
    obj: {
      type: t.object( {
        foo: {
          type: "array",
          merge: "concat"
        }
      } )
    }
  }, {
    obj: {
      foo: [ 1 ]
    }
  }, {
    obj: {
      foo: [ 0 ]
    }
  } );

  d( {
    obj: {
      type: t.object( {
        foo: {
          type: t.array(),
          merge: "concat"
        }
      } )
    }
  }, {
    obj: {
      foo: [ 1 ]
    }
  }, {
    obj: {
      foo: [ 0 ]
    }
  } );

  d( {
    obj: {
      type: t.object( {
        foo: {
          type: t.array(),
          merge: "spreadMeansConcat"
        }
      } )
    }
  }, {
    obj: {
      foo: [ 1 ]
    }
  }, {
    obj: {
      foo: [ 0 ]
    }
  } );

  d( {
    obj: {
      type: t.object( {
        foo: {
          type: t.array(),
          merge: "spreadMeansConcat"
        }
      } )
    }
  }, {
    obj: {
      foo: [ "...", 2 ]
    }
  }, {
    obj: {
      foo: [ "...", 1 ]
    }
  }, {
    obj: {
      foo: [ 0 ]
    }
  } );

  d( {
    obj: {
      type: t.object( {
        foo: {
          type: "array",
          merge: "merge"
        }
      } )
    }
  }, {
    obj: {
      foo: [ 1 ]
    }
  }, {
    obj: {
      foo: [ 0 ]
    }
  } );

  d( {
    obj: {
      type: t.object( {
        foo: {
          type: "array",
          merge() {
            return [];
          }
        }
      } )
    }
  }, {
    obj: {
      foo: [ 1 ]
    }
  }, {
    obj: {
      foo: [ 0 ]
    }
  } );

} );

it( "get config", async() => {

  let result = await getConfig( {
    cwd: __dirname,
    configFiles: "quase-config.js",
  } );

  expect( result.config.iAmTheConfigFile ).toBe( "yes" );
  expect( typeof result.location ).toBe( "string" );

  result = await getConfig( {
    cwd: __dirname,
    configFiles: "non-existent-file.js",
  } );

  expect( result.config ).toBe( undefined );
  expect( result.location ).toBe( undefined );

  result = await getConfig( {
    cwd: __dirname,
    configFiles: "non-existent-file.js",
    configKey: "my-key"
  } );

  expect( result.config.configFromPkg ).toBe( "yes" );
  expect( result.location ).toBe( "pkg" );

  result = await getConfig( {
    cwd: __dirname,
    configFiles: "quase-config-2.js",
    configKey: "my-key"
  } );

  expect( result.config.iAmTheConfigFile2 ).toBe( "yes" );
  expect( result.config.configFromPkg ).toBe( undefined );
  expect( typeof result.location ).toBe( "string" );
  expect( result.location ).not.toBe( "pkg" );

  await expect(
    getConfig( {
      cwd: __dirname,
      configFiles: "non-existante-file.js",
      failIfNotFound: true
    } )
  ).rejects.toThrow( /^Config file was not found/ );

  result = await getConfig( {
    cwd: __dirname,
    configFiles: [],
    configKey: ""
  } );

  expect( result.config ).toBe( undefined );
  expect( result.location ).toBe( undefined );

  result = await getConfig( {
    cwd: __dirname,
    arg: 10,
    configFiles: "quase-config-3.js"
  } );

  expect( result.config.fromFunction ).toBe( "yes" );
  expect( result.config.arg ).toBe( 10 );
  expect( typeof result.location ).toBe( "string" );
  expect( result.location ).not.toBe( "pkg" );

} );
