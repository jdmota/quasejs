const test = require( "../dist" );

test( () => {
  const e = new Error( "Error message" );
  e.expected = { a: 10 };
  e.actual = { b: 20 };
  throw e;
} );
