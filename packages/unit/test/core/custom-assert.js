import Runner from "../../src/core/runner";
import assert from "../../../assert";

describe( "unit", () => {

  it( "custom assert", () => {

    let runner = Runner.init( {
      assertions: [
        {
          fail() {
            const e = new Error( "custom failed assertion" );
            e.expected = "abcadsadedascasdac";
            e.actual = "bcedabhdytewvdhagvda";
            throw e;
          }
        }
      ]
    } );

    let results = runner.listen();
    let test = runner.test;

    test( t => {
      t.fail();
    } );

    return runner.run().then( function() {
      assert.deepEqual( results[ 5 ].status, "failed" );
      assert.strictEqual( results[ 5 ].errors[ 0 ].message, "custom failed assertion" );
      assert.strictEqual( results.pop().status, "failed" );
    } );

  } );

} );
