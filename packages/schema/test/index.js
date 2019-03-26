import runtime from "../src/runtime";
import schemaCompiler from "../src/compiler";

const stripAnsi = require( "strip-ansi" );
const { printError } = runtime;

/* eslint no-console: 0 */

function run( schema, ...args ) {
  const code = schemaCompiler( schema );
  expect( code ).toMatchSnapshot( "code" );

  const { error: prevError, warn: prevWarn } = console;
  const mock = jest.fn();
  console.error = mock;
  console.warn = mock;
  try {
    /* eslint no-eval: 0 */
    const { validateAndMerge } = eval( code.replace( "@quase/schema", "../src/index" ) );
    expect( validateAndMerge( ...args ) ).toMatchSnapshot( "result" );
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
  ).toMatchSnapshot( "log output" );
  console.error = prevError;
  console.warn = prevWarn;
}

it( "schema compilation", () => {

  expect( () => schemaCompiler( `
    type BadCircularity = BadCircularity;
    type Schema {
      obj: BadCircularity;
    }
  ` ) ).toThrowErrorMatchingSnapshot();

  expect( () => schemaCompiler( `
    type BadCircularity = BadCircularity | string;
    type Schema {
      obj: BadCircularity;
    }
  ` ) ).toThrowErrorMatchingSnapshot();

  expect( () => schemaCompiler( `
    type BadCircularity @example("") = BadCircularity | string;
    type Schema {
      obj: BadCircularity;
    }
  ` ) ).toThrowErrorMatchingSnapshot();

  expect( () => schemaCompiler( `
    type BadCircularity = IndirectCircularity;
    type IndirectCircularity = BadCircularity;
    type Schema {
      obj: IndirectCircularity;
    }
  ` ) ).toThrowErrorMatchingSnapshot();

  expect( () => schemaCompiler( `
    type AllowedCircularity = AllowedCircularity[] | string;
    type Schema {
      obj: AllowedCircularity;
    }
  ` ) ).not.toThrow();

  expect( () => schemaCompiler( `
    type Schema {
      obj: Schema;
    }
  ` ) ).not.toThrow();

  expect( () => schemaCompiler( `
    type Schema {
      string: string;
    }
    type Schema {
      string: string;
    }
  ` ) ).toThrowErrorMatchingSnapshot();

  expect( () => schemaCompiler( `
    type NotSchema {
      string: string;
    }
  ` ) ).toThrowErrorMatchingSnapshot();

  expect( () => schemaCompiler( `
    type Schema {
      string: NotDefined;
    }
  ` ) ).toThrowErrorMatchingSnapshot();

} );

it( "validate", () => {

  run( `
    type Schema {
      deprecated: boolean @deprecated;
    }
  `, {
    deprecated: true
  } );

  run( `
    type Schema {
      config: string;
    }
  `, {
    config: true
  } );

  run( `
    type Schema {
      obj: type {
        foo: type {
          bar: string @example("example");
        };
      };
    }
  `, {
    obj: {
      foo: {
        bar: 10
      }
    }
  } );

  run( `
    type Schema {
      obj: type {
        foo: type {
          bar: string @example("example");
        };
      };
    }
  `, {
    obj: {
      foo: 10
    }
  } );

  run( `
    type Schema {
      obj: type {
        foo: type {
          bar: string @example("example");
        };
      };
    }
  `, {
    obj: {
      foo: {
        baz: "abc"
      }
    }
  } );

  run( `
    type StringExample @example("example") = string;
    type Schema {
      obj: type {
        foo: [
          StringExample,
          StringExample
        ];
      };
    }
  `, {
    obj: {
      foo: [ "string", 10 ]
    }
  } );

  run( `
    type StringExample @example("example") = string;
    type Schema {
      obj: type {
        foo: [
          StringExample,
          StringExample
        ];
      };
    }
  `, {
    obj: {
      foo: {}
    }
  } );

  run( `
    type Schema {
      obj: type {
        foo: (string | number) @example("example");
      };
    }
  `, {
    obj: {
      foo: [ "string", 10 ]
    }
  } );

  run( `
    type Schema {
      obj: type {
        foo: (0 | 1) @example(1);
      };
    }
  `, {
    obj: {
      foo: 2
    }
  } );

  run( `
    type Schema {
      optional: boolean?;
    }
  `, {
    optional: undefined
  } );

  run( `
    type Schema {
      required: boolean;
    }
  `, {
    required: undefined
  } );

  run( `
    type Schema {
      obj: type {
        foo: 0 | 1 | "Object";
      };
    }
  `, {
    obj: {
      foo: 2
    }
  } );

  run( `
    type Schema {
      obj: type {
        foo: 0 | 1 | Object;
      };
    }
  `, {
    obj: {
      foo: 2
    }
  } );

  run( `
    type Schema {
      obj: type {
        foo: 0 | 1 | Object;
      };
    }
  `, {
    obj: {
      foo: 0
    }
  } );

  run( `
    type Schema {
      foo: type {
        boolean: boolean;
      };
    }
  `, {
    foo: {
      boolean: true,
      unknown: "stuff"
    }
  } );

  run( `
    type Schema {
      foo: type @additionalProperties {
        boolean: boolean;
      };
    }
  `, {
    foo: {
      boolean: true,
      unknown: "stuff"
    }
  } );

  run( `
    type Schema {
      obj: type {
        foo: string[] @example(js(${JSON.stringify( "aaaaaaaaaaaaaaaaaaaa".split( "" ) )}));
      };
    }
  `, {
    obj: {
      foo: {}
    }
  } );

  run( `
    type Schema {
      obj: any;
    }
  `, {
    obj: {
      foo: {}
    }
  } );

  run( `
    type Schema {
      obj: any[];
    }
  `, {
    obj: [ 1, {}, [] ]
  } );

  run( `
    type Schema {
      obj: type {
        foo: 0 | 1 | Object;
      };
      obj2: type {
        bar: 0 | 1 | Object;
      };
    }
  `, {
    obj: {
      foo: 1
    },
    obj2: {
      bar: {}
    }
  } );

  run( `
    type Schema {
      obj: [ string, number, 0 | 1 ];
    }
  `, {
    obj: [ "", 0, 1, 10 ]
  } );

  const obj = {
    obj: null
  };
  obj.obj = obj;

  run( `
    type Schema {
      obj: Schema;
    }
  `, obj );

  run( `
    type Schema {
      foo: number;
    }
  `, {} );

  run( `
    type B @default(true) = boolean;
    type Schema {
      watch: B @alias("w");
    }
  `, {} );

} );

/* it( "show where the error is", () => {

  function d( schema, ...args ) {
    try {
      const { validateAndMerge } = schemaCompiler( schema );
      // eslint no-eval: 0
      const fn = eval( validateAndMerge.replace( "@quase/schema", "../src/index" ) );
      expect( fn( ...args, [ "a", "b", "c" ] ) ).toMatchSnapshot();
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

} ); */

it( "apply defaults", () => {

  run( `
    type A @default("A") = string;
    type B @default("B") = string;
    type Schema {
      foo: [ A, B ];
    }
  `, {
    foo: []
  } );

  run( `
    type Schema {
      foo: type {
        a: any @default(10);
        b: any @default(20);
      };
    }
  `, {
    foo: {}
  } );

  run( `
    type Schema {
      foo: type {
        a: any @default(10);
        b: any @default(20);
      };
    }
  `, {
    foo: {
      a: 100
    }
  } );

  run( `
    type Schema {
      foo: string[];
    }
  `, {} );

  run( `
    type Schema {
      foo: type {

      };
    }
  `, {} );

  run( `
    type Schema {
      foo: number?;
    }
  `, {} );

  run( `
    type Schema {
      foo: number @default(10);
    }
  `, {} );

  run( `
    type Schema {
      foo: string?;
    }
  `, {
    foo: "string"
  }, {
    foo: undefined
  } );

  run( `
    type Schema {
      foo: type @additionalProperties {};
    }
  `, {
    foo: {}
  }, {
    foo: {
      abc: "string"
    }
  } );

  run( `
    type Schema {
      foo: string[];
    }
  `, {
    foo: undefined
  }, {
    foo: [ "foo" ]
  } );

} );

it( "apply defaults - merge strategies", () => {

  run( `
    type Schema {
      obj: type {
        foo: number[] @mergeStrategy("concat");
      };
    }
  `, {
    obj: {
      foo: [ 0 ]
    }
  }, {
    obj: {
      foo: [ 1 ]
    }
  } );

  run( `
    type Schema {
      obj: type {
        foo: number[] @mergeStrategy("override");
      };
    }
  `, {
    obj: {
      foo: [ 0 ]
    }
  }, {
    obj: {
      foo: [ 1 ]
    }
  } );

  run( `
    type Schema {
      obj: type {
        foo: number[] @mergeStrategy("spreadMeansConcat");
      };
    }
  `, {
    obj: {
      foo: [ 0 ]
    }
  }, {
    obj: {
      foo: [ 1 ]
    }
  } );

  run( `
    type Schema {
      obj: type {
        foo: number[] @mergeStrategy("spreadMeansConcat");
      };
    }
  `, {
    obj: {
      foo: [ 0 ]
    }
  }, {
    obj: {
      foo: [ "...", 1 ]
    }
  }, {
    obj: {
      foo: [ "...", 2 ]
    }
  } );

  run( `
    type Schema {
      obj: type {
        foo: number[] @mergeStrategy("concat");
      };
    }
  `, {
    obj: {}
  }, {
    obj: {
      foo: [ 0 ]
    }
  }, {
    obj: {
      foo: [ 1 ]
    }
  } );

  run( `
    type Schema {
      obj: type {
        foo: number[] @mergeStrategy("override");
      };
    }
  `, {
    obj: {}
  }, {
    obj: {
      foo: [ 0 ]
    }
  }, {
    obj: {
      foo: [ 1 ]
    }
  } );

  run( `
    type Schema {
      obj: type {
        foo: number[] @mergeStrategy("spreadMeansConcat");
      };
    }
  `, {
    obj: {}
  }, {
    obj: {
      foo: [ 0 ]
    }
  }, {
    obj: {
      foo: [ 1 ]
    }
  } );

  run( `
    type Schema {
      obj: type {
        foo: number[] @mergeStrategy("spreadMeansConcat");
      };
    }
  `, {
    obj: {}
  }, {
    obj: {
      foo: [ 0 ]
    }
  }, {
    obj: {
      foo: [ "...", 1 ]
    }
  }, {
    obj: {
      foo: [ "...", 2 ]
    }
  } );

} );

it( "cli", () => {

  run( `
    type Schema {
      foo: string
        @description("description of this option")
        @default("default")
        @example("example")
        @alias("f","fo");
    }
  `, {
    foo: undefined
  } );

} );
