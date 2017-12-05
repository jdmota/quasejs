const test = require( "../dist" );

test( t => {
  t.incCount();
  t.log( "line 1\nline 2" );
  t.log( "line 1\nline 2" );
} );

test( () => {
  const e = new Error( "Error message" );
  e.expected = { a: 10 };
  e.actual = { b: 20 };
  throw e;
} );
