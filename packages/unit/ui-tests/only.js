const test = require( "../dist" );

test( "Test 1", () => {
  throw new Error();
} );

test.only( "Test 2", t => {
  t.incCount();
} );

test( "Test 3", () => {
  throw new Error();
} );
