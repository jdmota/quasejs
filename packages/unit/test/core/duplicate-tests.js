import Runner from "../../src/core/runner";

describe( "unit", () => {

  it( "duplicate test", () => {

    const test = Runner.init().test;

    test( "Example test", t => {
      t.incCount();
    } );

    try {
      test( "Example test", t => {
        t.incCount();
      } );
    } catch ( err ) {
      expect( /Duplicate/.test( err.message ) ).toBe( true );
    }

  } );

} );
