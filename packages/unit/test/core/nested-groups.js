import Runner from "../../src/core/runner";
import assert from "../../../assert";

describe( "unit", () => {

  it( "nested groups", () => {

    assert.expect( 2 );

    let runner = Runner.init( { allowNoPlan: true } );
    let results = runner.listen();
    let test = runner.test;

    let actual = [];
    let expected = [
      "test 1",
      "test 2",
      "test 3",
      "test 4",
      "test 5"
    ];

    test.group( "group 1", function() {

      test( function() {
        actual.push( "test 1" );
      } );

      test.group( "group 2", function() {

        test( function() {
          actual.push( "test 2" );
        } );

        test( function() {
          actual.push( "test 3" );
        } );

        test.group( "group 3", function() {

          test( function( t ) {
            actual.push( "test 4" );
            t.skip();
          } );

          test( function() {
            actual.push( "test 5" );
            throw new Error( "Error" );
          } );

        } );

      } );

    } );

    return runner.run().then( function() {
      assert.deepEqual( actual, expected );
      assert.deepEqual( results[ results.length - 1 ].testCounts, {
        passed: 3,
        skipped: 1,
        failed: 1,
        todo: 0,
        total: 5
      } );
    } );

  } );

  it( "nested groups with alternative api", () => {

    assert.expect( 9 );

    let runner = Runner.init( { allowNoPlan: true } );
    let results = runner.listen();
    let test = runner.test;

    let actual = [];
    let expected = [
      "test 1",
      "test 2",
      "test 3",
      "test 4",
      "test 5"
    ];

    test.group( "group 1", function( group ) {

      group.test( function() {
        actual.push( "test 1" );
      } );

      const group2 = test.group( "group 2" );

      assert.strictEqual( "timeout" in group2, true );
      assert.strictEqual( "retries" in group2, true );
      assert.strictEqual( "slow" in group2, true );

      group2.test( function() {
        actual.push( "test 2" );
      } );

      group2.test( function() {
        actual.push( "test 3" );
      } );

      group2.group( "group 3", function() {

        test( function( t ) {
          actual.push( "test 4" );
          t.skip();
        } );

        test( function() {
          actual.push( "test 5" );
          throw new Error( "Error" );
        } );

      } );

    } );

    return runner.run().then( function() {
      assert.deepEqual( actual, expected );
      assert.deepEqual( results[ 3 ].tests.length, 1 );
      assert.strictEqual( results[ 3 ].childSuites.length, 1 );
      assert.strictEqual( results[ 3 ].testCounts.total, 5 );
      assert.deepEqual( results[ 21 ], {
        fullname: [ "group 1", "group 2", "group 3", "[anonymous]" ],
        name: "[anonymous]",
        suiteName: "group 3"
      } );
      assert.deepEqual( results[ results.length - 1 ].testCounts, {
        passed: 3,
        skipped: 1,
        failed: 1,
        todo: 0,
        total: 5
      } );
    } );

  } );

} );
