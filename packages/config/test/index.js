import { t, validate, printError, applyDefaults, getConfig } from "../src";

const stripAnsi = require( "strip-ansi" );

/* eslint no-console: 0 */

function v( options, schema ) {
  const mock = jest.fn();
  console.error = mock;
  console.warn = mock;
  try {
    validate( schema, options );
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

} );

function d( schema, ...args ) {
  expect( applyDefaults( schema, ...args ) ).toMatchSnapshot();
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
      type: "number"
    }
  } );

  d( {
    obj: {
      type: "number",
      default: 0
    }
  } );

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

it( "get config", () => {

  let result = getConfig( {
    cwd: __dirname,
    configFiles: "quase-config.js",
  } );

  expect( result.config.iAmTheConfigFile ).toBe( "yes" );
  expect( typeof result.location ).toBe( "string" );

  result = getConfig( {
    cwd: __dirname,
    configFiles: "non-existent-file.js",
  } );

  expect( result.config ).toBe( undefined );
  expect( result.location ).toBe( undefined );

  result = getConfig( {
    cwd: __dirname,
    configFiles: "non-existent-file.js",
    configKey: "my-key"
  } );

  expect( result.config.configFromPkg ).toBe( "yes" );
  expect( result.location ).toBe( "pkg" );

  result = getConfig( {
    cwd: __dirname,
    configFiles: "quase-config-2.js",
    configKey: "my-key"
  } );

  expect( result.config.iAmTheConfigFile2 ).toBe( "yes" );
  expect( result.config.configFromPkg ).toBe( undefined );
  expect( typeof result.location ).toBe( "string" );
  expect( result.location ).not.toBe( "pkg" );

  expect( () => {
    getConfig( {
      cwd: __dirname,
      configFiles: "non-existante-file.js",
      failIfNotFound: true
    } );
  } ).toThrow( /^Config file was not found/ );

  result = getConfig( {
    cwd: __dirname,
    configFiles: [],
    configKey: ""
  } );

  expect( result.config ).toBe( undefined );
  expect( result.location ).toBe( undefined );

} );