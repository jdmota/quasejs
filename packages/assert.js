export default {
  ok( a ) {
    expect( a ).toBeTruthy();
  },
  strictEqual( a, b ) {
    expect( a ).toBe( b );
  },
  notStrictEqual( a, b ) {
    expect( a ).not.toBe( b );
  },
  deepEqual( a, b ) {
    expect( a ).toEqual( b );
  },
  notDeepEqual( a, b ) {
    expect( a ).not.toEqual( b );
  },
  throws( a, b ) {
    expect( a ).toThrow( b );
  },
  expect( n ) {
    expect.assertions( n );
  }
};

/* eslint no-console: 0 */

const join = [].join;

function factory( type ) {
  return function( block, expected ) {
    const ref = console[ type ];
    let actual;
    console[ type ] = function() {
      actual = ( actual ? actual + "\n" : "" ) + join.call( arguments, " " );
    };
    block();
    console[ type ] = ref;
    expect( actual ).toBe( expected );
  };
}

export const testConsoleLog = factory( "log" );
export const testConsoleError = factory( "error" );

export const testLog = testConsoleLog; // Alias
