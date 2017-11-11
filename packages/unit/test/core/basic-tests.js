import { Runner } from "../../src";
import assert from "../../../assert";

describe( "unit", () => {

  it( "failed test", () => {

    let runner = Runner.init();
    let results = runner.listen();
    let test = runner.test;

    test( t => {
      t.plan( 10 );
      t.incCount();
      t.incCount();
    } );

    return runner.run().then( function() {

      assert.strictEqual( results[ 0 ], "runStart" );
      assert.strictEqual( results[ 6 ], "runEnd" );

      assert.strictEqual( results[ 2 ], "testStart" );
      assert.deepEqual( results[ 3 ], {
        name: "[anonymous]",
        fullname: [ "[anonymous]" ],
        suiteName: undefined
      } );

      assert.strictEqual( results[ 4 ], "testEnd" );

      assert.strictEqual( typeof results[ 5 ].runtime, "number" );

      assert.deepEqual( results[ 5 ].status, "failed" );

      assert.strictEqual( results[ 5 ].errors[ 0 ].message, "Planned 10 but 2 assertions were run." );

      assert.strictEqual( results[ 5 ].assertions[ 0 ].message, "Planned 10 but 2 assertions were run." );

      assert.strictEqual( results.pop().status, "failed" );

    } );

  } );

  it( "passed test", () => {

    let runner = Runner.init();
    let results = runner.listen();
    let test = runner.test;

    test( function( t ) {
      t.plan( 0 );
    } );

    return runner.run().then( function() {

      assert.strictEqual( results[ 0 ], "runStart" );
      assert.strictEqual( results[ 6 ], "runEnd" );

      assert.strictEqual( results[ 2 ], "testStart" );
      assert.deepEqual( results[ 3 ], {
        name: "[anonymous]",
        fullname: [ "[anonymous]" ],
        suiteName: undefined
      } );

      assert.strictEqual( results[ 4 ], "testEnd" );

      assert.strictEqual( typeof results[ 5 ].runtime, "number" );

      delete results[ 5 ].runtime;

      assert.deepEqual( results[ 5 ], {
        name: "[anonymous]",
        fullname: [ "[anonymous]" ],
        suiteName: undefined,
        status: "passed",
        errors: [],
        skipReason: undefined,
        slow: false,
        assertions: []
      } );

      assert.strictEqual( results.pop().status, "passed" );

    } );

  } );

  it( "skipped test", () => {

    let runner = Runner.init();
    let results = runner.listen();
    let test = runner.test;

    test( function( t ) {
      t.plan( 10 );
      t.skip( "skip reason" );
    } );

    return runner.run().then( function() {

      assert.strictEqual( results[ 0 ], "runStart" );
      assert.strictEqual( results[ 6 ], "runEnd" );

      assert.strictEqual( results[ 2 ], "testStart" );
      assert.deepEqual( results[ 3 ], {
        name: "[anonymous]",
        fullname: [ "[anonymous]" ],
        suiteName: undefined
      } );

      assert.strictEqual( results[ 4 ], "testEnd" );

      assert.strictEqual( typeof results[ 5 ].runtime, "number" );

      delete results[ 5 ].runtime;

      assert.deepEqual( results[ 5 ], {
        name: "[anonymous]",
        fullname: [ "[anonymous]" ],
        suiteName: undefined,
        status: "skipped",
        errors: [],
        skipReason: "skip reason",
        slow: false,
        assertions: []
      } );

      assert.strictEqual( results.pop().status, "skipped" );

    } );

  } );

  it( "failed test has always failed status", () => {

    let runner = Runner.init();
    let results = runner.listen();
    let test = runner.test;

    test( t => {
      return new Promise( ( resolve, reject ) => {
        setTimeout( () => {
          try {
            t.skip( "reason" );
          } catch ( e ) {
            // Ignore
          }
          reject( "message" );
        } );
      } );
    } );

    return runner.run().then( function() {

      assert.strictEqual( results[ 0 ], "runStart" );
      assert.strictEqual( results[ 6 ], "runEnd" );

      assert.strictEqual( results[ 2 ], "testStart" );
      assert.deepEqual( results[ 3 ], {
        name: "[anonymous]",
        fullname: [ "[anonymous]" ],
        suiteName: undefined
      } );

      assert.strictEqual( results[ 4 ], "testEnd" );

      assert.strictEqual( typeof results[ 5 ].runtime, "number" );

      assert.deepEqual( results[ 5 ].status, "failed" );

      assert.deepEqual( results[ 5 ].skipReason, undefined );

      assert.strictEqual( results[ 5 ].errors[ 0 ].message, "message" );

      assert.strictEqual( results[ 5 ].assertions[ 0 ].message, "message" );

      assert.strictEqual( results.pop().status, "failed" );

    } );

  } );

} );
