const test = require( "../../dist" );

test.group( "group", () => {
  test( "test", t => {
    t.plan( 0 );
  } );

  return Promise.reject( "reject" );
} );
