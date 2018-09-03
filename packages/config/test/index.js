import { t, types, validate, printError, apply, getConfig, ValidationError } from "../src";

const stripAnsi = require( "strip-ansi" ); // eslint-disable-line node/no-extraneous-require

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
      type: "boolean",
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
    obj: t.object( {
      properties: {
        foo: t.object( {
          properties: {
            bar: {
              type: "string",
              example: "example"
            }
          }
        } )
      }
    } )
  } );

  v( {
    obj: {
      foo: 10
    }
  }, {
    obj: t.object( {
      properties: {
        foo: t.object( {
          properties: {
            bar: {
              type: "string",
              example: "example"
            }
          }
        } )
      }
    } )
  } );

  v( {
    obj: {
      foo: {
        baz: "abc"
      }
    }
  }, {
    obj: t.object( {
      properties: {
        foo: t.object( {
          properties: {
            bar: {
              type: "string",
              example: "example"
            }
          }
        } )
      }
    } )
  } );

  v( {
    obj: {
      foo: [ "string", 10 ]
    }
  }, {
    obj: t.object( {
      properties: {
        foo: t.tuple( {
          items: [
            {
              type: "string",
              example: "example"
            }, {
              type: "string",
              example: "example"
            }
          ]
        } )
      }
    } )
  } );

  v( {
    obj: {
      foo: {}
    }
  }, {
    obj: t.object( {
      properties: {
        foo: t.tuple( {
          items: [
            {
              type: "string",
              example: "example"
            }, {
              type: "string",
              example: "example"
            }
          ]
        } )
      }
    } )
  } );

  v( {
    obj: {
      foo: [ "string", 10 ]
    }
  }, {
    obj: t.object( {
      properties: {
        foo: t.union( {
          types: [
            "string",
            "number"
          ],
          example: "example"
        } )
      }
    } )
  } );

  v( {
    obj: {
      foo: 2
    }
  }, {
    obj: t.object( {
      properties: {
        foo: t.choices( {
          values: [
            0,
            1
          ],
          example: 1
        } )
      }
    } )
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
    obj: t.object( {
      properties: {
        foo: t.union( {
          types: [ 0, 1, "object" ].map( v => t.value( { value: v } ) ),
          example: 1
        } )
      }
    } )
  } );

  v( {
    obj: {
      foo: 2
    }
  }, {
    obj: t.object( {
      properties: {
        foo: t.union( {
          types: [ t.value( { value: 0 } ), t.value( { value: 1 } ), "object" ],
          example: 1
        } )
      }
    } )
  } );

  v( {
    obj: {
      foo: 0
    }
  }, {
    obj: t.object( {
      properties: {
        foo: t.union( {
          types: [ t.value( { value: 0 } ), t.value( { value: 1 } ), "object" ],
          example: 1
        } )
      }
    } )
  } );

  class CustomType extends types.Type {
    validate( path, value, dest ) {
      if ( dest.bar === true ) {
        throw new ValidationError( "foo and bar should not be set at the same time" );
      }
    }
  }

  v( {
    foo: true,
    bar: true
  }, {
    foo: new CustomType(),
    bar: {
      type: "boolean"
    }
  } );

  v( {
    foo: {
      boolean: true,
      unknown: "stuff"
    }
  }, {
    foo: t.object( {
      properties: {
        boolean: {
          type: "boolean"
        }
      }
    } )
  } );

  v( {
    foo: {
      boolean: true,
      unknown: "stuff"
    }
  }, {
    foo: t.object( {
      properties: {
        boolean: {
          type: "boolean"
        }
      },
      additionalProperties: true
    } )
  } );

  v( {
    obj: {
      foo: {}
    }
  }, {
    obj: t.object( {
      properties: {
        foo: t.array( {
          itemType: "string",
          example: "aaaaaaaaaaaaaaaaaaaa".split( "" )
        } )
      }
    } )
  } );

  v( {
    obj: {
      foo: {}
    }
  }, {
    obj: {
      type: "any"
    }
  } );

  v( {
    obj: [ 1, {}, [] ]
  }, {
    obj: t.array( {
      itemType: "any"
    } )
  } );

} );

function d( schema, ...args ) {
  try {
    expect( apply( schema, [ ...args ] ) ).toMatchSnapshot();
  } catch ( err ) {
    if ( err.__validation || /\[Schema\] [^I]/.test( err.message ) ) {
      expect( stripAnsi( err.message ) ).toMatchSnapshot();
    } else {
      expect( stripAnsi( err.stack ) ).toMatchSnapshot();
    }
  }
}

it( "show where the error is", () => {

  function d( schema, ...args ) {
    try {
      expect( apply( schema, [ ...args ], [ "a", "b", "c" ] ) ).toMatchSnapshot();
    } catch ( err ) {
      if ( err.__validation || /\[Schema\] [^I]/.test( err.message ) ) {
        expect( stripAnsi( err.message ) ).toMatchSnapshot();
      } else {
        expect( stripAnsi( err.stack ) ).toMatchSnapshot();
      }
    }
  }

  d( {
    obj: t.object( {
      properties: {
        prop: {
          type: "string",
          optional: true
        }
      }
    } )
  }, {
    obj: {
      prop: "text"
    }
  }, {
    obj: [ "text" ]
  } );

} );

it( "apply defaults", () => {

  d( {
    obj: t.object( {
      properties: {
        foo: t.tuple( {
          items: [
            {
              type: "string",
              default: "a"
            }, {
              type: "string",
              default: "b"
            }
          ]
        } )
      }
    } )
  }, {
    obj: {
      foo: []
    }
  } );

  d( {
    obj: t.object( {
      properties: {
        foo: t.object( {
          properties: {
            a: {
              type: "any",
              default: 10
            },
            b: {
              type: "any",
              default: 20
            }
          }
        } )
      }
    } )
  }, {
    obj: {}
  } );

  d( {
    obj: t.object( {
      properties: {
        foo: t.object( {
          properties: {
            a: {
              type: "any",
              default: 10
            },
            b: {
              type: "any",
              default: 20
            }
          }
        } )
      }
    } )
  }, {
    obj: {
      foo: 100
    }
  } );

  d( {
    obj: "boolean"
  } );

  d( {
    obj: "array"
  } );

  d( {
    obj: "object"
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
  }, {}, {} );

  d( {
    obj: {
      type: "boolean",
      optional: true
    }
  } );

  d( {
    obj: t.object( {
      properties: {
        a: {
          type: "boolean",
          default: true
        },
        b: {
          type: "boolean",
          default: true
        }
      },
      map: x => (
        x === true ? undefined : x === false ? { a: false, b: false } : x
      )
    } )
  }, {
    obj: true
  } );

  d( {
    obj: t.object( {
      properties: {
        a: {
          type: "boolean",
          default: true
        },
        b: {
          type: "boolean",
          default: true
        }
      },
      map: x => (
        x === true ? undefined : x === false ? { a: false, b: false } : x
      )
    } )
  }, {
    obj: false
  } );

  d( {
    obj: t.object( {
      properties: {
        a: {
          type: "boolean",
          default: true
        },
        b: {
          type: "boolean",
          default: true
        }
      },
      map: x => (
        x === true ? undefined : x === false ? { a: false, b: false } : x
      )
    } )
  }, {
    obj: undefined
  } );

  d( {
    obj: t.object( {
      properties: {
        a: {
          type: "boolean",
          default: true
        },
        b: {
          type: "boolean",
          default: true
        }
      },
      map: x => (
        x === true ? undefined : x === false ? { a: false, b: false } : x
      )
    } )
  }, {
    obj: true
  }, {
    obj: {
      a: false
    }
  }, {
    obj: true
  } );

  class CustomType extends types.Type {
    defaults( path, dest ) {
      if ( dest.mode === "production" ) {
        return true;
      }
      return false;
    }
  }

  d( {
    mode: {
      type: "string",
      optional: true
    },
    minify: new CustomType()
  }, {
    mode: "production"
  } );

} );

it( "apply defaults - merge modes", () => {

  d( {
    obj: t.object( {
      properties: {
        foo: {
          type: "array",
          itemType: "number",
          merge: "concat"
        }
      }
    } )
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
    obj: t.object( {
      properties: {
        foo: t.array( {
          itemType: "number",
          merge: "concat"
        } )
      }
    } )
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
    obj: t.object( {
      properties: {
        foo: t.array( {
          itemType: "number",
          merge: "spreadMeansConcat"
        } )
      }
    } )
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
    obj: t.object( {
      properties: {
        foo: t.array( {
          itemType: "number",
          merge: "spreadMeansConcat"
        } )
      }
    } )
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
    obj: t.object( {
      properties: {
        foo: {
          type: "array",
          itemType: "number",
          merge: "merge"
        }
      }
    } )
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
  expect( typeof result.location ).toBe( "string" );
  expect( result.location.endsWith( "package.json" ) ).toBe( true );

  result = await getConfig( {
    cwd: __dirname,
    configFiles: "quase-config-2.js",
    configKey: "my-key"
  } );

  expect( result.config.iAmTheConfigFile2 ).toBe( "yes" );
  expect( result.config.configFromPkg ).toBe( undefined );
  expect( result.location.endsWith( "quase-config-2.js" ) ).toBe( true );

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
  expect( result.location.endsWith( "quase-config-3.js" ) ).toBe( true );

} );
