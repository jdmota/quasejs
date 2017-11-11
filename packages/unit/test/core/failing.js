import { Runner } from "../../src";
import assert from "../../../assert";

describe( "unit", () => {

  it( "failing", () => {

    assert.expect( 10 );

    let runner = Runner.init( { allowNoPlan: true } );
    let results = runner.listen();
    let t = runner.test;

    t.failing( "failing test", function() {
      throw new Error( "abc" );
    } );

    t.failing( "failing test 2", function() {} );

    return runner.run().then( function() {

      assert.strictEqual( results[ 2 ], "testStart" );
      assert.deepEqual( results[ 3 ], {
        name: "failing test",
        fullname: [ "failing test" ],
        suiteName: undefined
      } );

      assert.deepEqual( results[ 4 ], "testEnd" );
      assert.deepEqual( results[ 5 ].status, "passed" );

      assert.strictEqual( results[ 6 ], "testStart" );
      assert.deepEqual( results[ 7 ], {
        name: "failing test 2",
        fullname: [ "failing test 2" ],
        suiteName: undefined
      } );

      assert.strictEqual( results[ 8 ], "testEnd" );
      assert.strictEqual( results[ 9 ].status, "failed" );
      assert.strictEqual(
        results[ 9 ].errors[ 0 ].message,
        "Test was expected to fail, but succeeded, you should stop marking the test as failing."
      );

      assert.strictEqual( results.pop().status, "failed" );

    } );

  } );

  it( "failing in groups", () => {

    assert.expect( 9 );

    let runner = Runner.init( { allowNoPlan: true } );
    let results = runner.listen();
    let t = runner.test;

    t.group.failing( "group", function() {

      t( "failing test", function() {
        throw new Error( "abc" );
      } );

      t( "failing test 2", function() {
        throw new Error( "abc" );
      } );

    } );

    return runner.run().then( function() {

      assert.strictEqual( results[ 4 ], "testStart" );
      assert.deepEqual( results[ 5 ], {
        name: "failing test",
        fullname: [ "group", "failing test" ],
        suiteName: "group"
      } );

      assert.deepEqual( results[ 6 ], "testEnd" );
      assert.deepEqual( results[ 7 ].status, "passed" );

      assert.strictEqual( results[ 8 ], "testStart" );
      assert.deepEqual( results[ 9 ], {
        name: "failing test 2",
        fullname: [ "group", "failing test 2" ],
        suiteName: "group"
      } );

      assert.strictEqual( results[ 10 ], "testEnd" );
      assert.strictEqual( results[ 11 ].status, "passed" );

      assert.strictEqual( results.pop().status, "passed" );

    } );

  } );

  it( "failing in groups 2", () => {

    assert.expect( 10 );

    let runner = Runner.init( { allowNoPlan: true } );
    let results = runner.listen();
    let t = runner.test;

    t.group.failing( "group", function() {

      t( "failing test", function() {
        throw new Error( "abc" );
      } );

      t( "failing test 2", function() {} );

    } );

    return runner.run().then( function() {

      assert.strictEqual( results[ 4 ], "testStart" );
      assert.deepEqual( results[ 5 ], {
        name: "failing test",
        fullname: [ "group", "failing test" ],
        suiteName: "group"
      } );

      assert.deepEqual( results[ 6 ], "testEnd" );
      assert.deepEqual( results[ 7 ].status, "passed" );

      assert.strictEqual( results[ 8 ], "testStart" );
      assert.deepEqual( results[ 9 ], {
        name: "failing test 2",
        fullname: [ "group", "failing test 2" ],
        suiteName: "group"
      } );

      assert.strictEqual( results[ 10 ], "testEnd" );
      assert.strictEqual( results[ 11 ].status, "failed" );
      assert.strictEqual(
        results[ 11 ].errors[ 0 ].message,
        "Test was expected to fail, but succeeded, you should stop marking the test as failing."
      );

      assert.strictEqual( results.pop().status, "failed" );

    } );

  } );

  it( "failing in groups 3", () => {

    assert.expect( 10 );

    let runner = Runner.init( { allowNoPlan: true } );
    let results = runner.listen();
    let t = runner.test;

    t.group.failing( "root", function() {

      t.group( "group", function() {

        t( "failing test", function() {
          throw new Error( "abc" );
        } );

        t( "failing test 2", function() {} );

      } );

    } );

    return runner.run().then( function() {

      assert.strictEqual( results[ 6 ], "testStart" );
      assert.deepEqual( results[ 7 ], {
        name: "failing test",
        fullname: [ "root", "group", "failing test" ],
        suiteName: "group"
      } );

      assert.deepEqual( results[ 8 ], "testEnd" );
      assert.deepEqual( results[ 9 ].status, "passed" );

      assert.strictEqual( results[ 10 ], "testStart" );
      assert.deepEqual( results[ 11 ], {
        name: "failing test 2",
        fullname: [ "root", "group", "failing test 2" ],
        suiteName: "group"
      } );

      assert.strictEqual( results[ 12 ], "testEnd" );
      assert.strictEqual( results[ 13 ].status, "failed" );
      assert.strictEqual(
        results[ 13 ].errors[ 0 ].message,
        "Test was expected to fail, but succeeded, you should stop marking the test as failing."
      );

      assert.strictEqual( results.pop().status, "failed" );

    } );

  } );

  it( "failing in groups with beforeEach", () => {

    assert.expect( 2 );

    let runner = Runner.init( { allowNoPlan: true } );
    let results = runner.listen();
    let t = runner.test;
    let actual = [];

    t.group.failing( "group", () => {

      t.beforeEach( () => {
        throw new Error( "abc" );
      } );

      t( () => {
        /* istanbul ignore next */
        actual.push( "don't run" );
      } );

    } );

    return runner.run().then( function() {
      assert.strictEqual( results.pop().status, "passed" );
      assert.deepEqual( actual, [] );
    } );

  } );

  it( "failing in group + skip test", () => {

    assert.expect( 1 );

    const runner = Runner.init( { allowNoPlan: true } );
    const results = runner.listen();
    const t = runner.test;

    t.group.failing( () => {

      t.skip( () => {
        /* istanbul ignore next */
        assert.ok( false );
      } );

    } );

    return runner.run().then( () => {
      assert.strictEqual( results.pop().status, "skipped" );
    } );

  } );

  it( "failing in group + todo test", () => {

    assert.expect( 1 );

    const runner = Runner.init( { allowNoPlan: true } );
    const results = runner.listen();
    const t = runner.test;

    t.group.failing( () => {

      t.todo( () => {
        /* istanbul ignore next */
        assert.ok( false );
      } );

    } );

    return runner.run().then( () => {
      assert.strictEqual( results.pop().status, "todo" );
    } );

  } );

} );
