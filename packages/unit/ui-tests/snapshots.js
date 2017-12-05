const test = require( "../dist" );

test( t => {
  t.matchesSnapshot( "abc" );
  t.matchesSnapshot( { abc: 10 } );
} );
