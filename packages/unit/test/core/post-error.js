import Runner from "../../src/core/runner";
import assert from "../../../assert";

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
      assert.strictEqual( results.pop().status, "passed" );
    } );

    const p2 = new Promise( resolve => {
      runner.on( "postError", err => {
        assert.strictEqual( err.message, "You should not call .timeout() after the test has finished." );
        resolve();
      } );
    } );

    return Promise.all( [ p1, p2 ] );

  } );

} );
