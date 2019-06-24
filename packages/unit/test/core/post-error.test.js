import Runner from "../../src/core/runner";

describe( "unit", () => {

  it( "post error", async() => {

    let runner = Runner.init( { allowNoPlan: true } );
    let results = runner.listen();
    let test = runner.test;

    test( t => {
      setTimeout( () => {
        t.timeout( 30 );
      }, 1 );
    } );

    const p1 = runner.run().then( () => {
      expect( results.pop().status ).toBe( "passed" );
    } );

    const p2 = new Promise( resolve => {
      runner.on( "otherError", err => {
        expect( err.message ).toBe( "You should not call .timeout() after the test has finished." );
        resolve();
      } );
    } );

    return Promise.all( [ p1, p2 ] );

  } );

} );
