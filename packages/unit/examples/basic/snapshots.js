const test = require( "../../dist" );

test( t => {
  t.matchesSnapshot( "abc", "key" );
  t.matchesSnapshot( { abc: 10 } );
} );
