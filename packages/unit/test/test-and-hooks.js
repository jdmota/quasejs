import unit from "../src";
import assert from "../../assert";

describe( "unit", () => {

  it( "error in before hook", () => {

    assert.expect( 4 );

    let runner = unit.Runner.init();
    let results = runner.listen();
    let t = runner.test;

    let actual = [];
    let expected = [
      "before",
      "after"
    ];

    t.before( function() {
      actual.push( "before" );
      throw new Error( "Error in hook." );
    } );

    t.test( function() {
      /* istanbul ignore next */
      actual.push( "don't run" );
    } );

    t.test( function() {
      /* istanbul ignore next */
      actual.push( "don't run" );
    } );

    t.group( function() {
      t( function() {
        /* istanbul ignore next */
        actual.push( "don't run" );
      } );
    } );

    t.after( function() {
      actual.push( "after" );
    } );

    return runner.run().then( function() {
      assert.deepEqual( actual, expected );
      assert.strictEqual( results[ 19 ].skipReason, "Failed because of an error in a previous hook." );
      assert.deepEqual( results[ results.length - 1 ].testCounts, {
        passed: 1,
        skipped: 3,
        failed: 1,
        todo: 0,
        total: 5
      } );
      assert.strictEqual( results.pop().status, "failed" );
    } );

  } );

  it( ".skip() in before hook", () => {

    assert.expect( 7 );

    let runner = unit.Runner.init();
    let results = runner.listen();
    let t = runner.test;

    let actual = [];
    let expected = [
      "before 1",
      "before 2",
      "after"
    ];

    t.before( function( t ) {
      actual.push( "before 1" );
      t.skip( "reason 1" );
    } );

    t.before( function( t ) {
      actual.push( "before 2" );
      t.skip( "reason 2" );
    } );

    t.test( "test1", function() {
      /* istanbul ignore next */
      actual.push( "don't run" );
    } );

    t.test( function() {
      /* istanbul ignore next */
      actual.push( "don't run" );
    } );

    t.group( function() {
      t( function() {
        /* istanbul ignore next */
        actual.push( "don't run" );
      } );
    } );

    t.after( function() {
      actual.push( "after" );
    } );

    return runner.run().then( function() {
      assert.deepEqual( actual, expected );
      assert.strictEqual( results[ 13 ].name, "test1" );
      assert.strictEqual( results[ 13 ].status, "skipped" );
      assert.strictEqual( results[ 13 ].skipReason, "reason 1" );
      assert.strictEqual( results[ 13 ].runtime, 0 );
      assert.deepEqual( results[ results.length - 1 ].testCounts, {
        passed: 1,
        skipped: 5,
        failed: 0,
        todo: 0,
        total: 6
      } );
      assert.strictEqual( results.pop().status, "passed" );
    } );

  } );

  it( "error in beforeEach hook", () => {

    assert.expect( 2 );

    let runner = unit.Runner.init();
    let results = runner.listen();
    let t = runner.test;

    let actual = [];
    let expected = [
      "group",
      "beforeEach",
      "afterEach"
    ];

    t.beforeEach( function() {
      actual.push( "beforeEach" );
      throw new Error( "Error" );
    } );

    t.test( function() {
      /* istanbul ignore next */
      actual.push( "don't run" );
    } );

    t.test( function() {
      /* istanbul ignore next */
      actual.push( "don't run" );
    } );

    t.group( function() {
      actual.push( "group" );
      t.test( function() {
        /* istanbul ignore next */
        actual.push( "don't run" );
      } );
    } );

    t.afterEach( function() {
      actual.push( "afterEach" );
    } );

    return runner.run().then( function() {
      assert.deepEqual( actual, expected );
      assert.strictEqual( results.pop().status, "failed" );
    } );

  } );

  it( ".skip() in beforeEach hook", () => {

    assert.expect( 3 );

    let runner = unit.Runner.init();
    let results = runner.listen();
    let t = runner.test;

    let actual = [];
    let expected = [
      "group",
      "beforeEach",
      "afterEach",
      "beforeEach",
      "afterEach"
    ];

    t.beforeEach( function( t ) {
      actual.push( "beforeEach" );
      t.skip();
    } );

    t.test( function() {
      /* istanbul ignore next */
      actual.push( "don't run" );
    } );

    t.test( function() {
      /* istanbul ignore next */
      actual.push( "don't run" );
    } );

    t.group( function() {
      actual.push( "group" );
    } );

    t.afterEach( function() {
      actual.push( "afterEach" );
    } );

    return runner.run().then( function() {
      assert.deepEqual( actual, expected );
      assert.strictEqual( results.length, 16 );
      assert.strictEqual( results.pop().status, "skipped" );
    } );

  } );

  it( "skip + error in beforeEach hooks", () => {

    assert.expect( 5 );

    let runner = unit.Runner.init();
    let results = runner.listen();
    let t = runner.test;

    let actual = [];
    let expected = [
      "beforeEach 1",
      "beforeEach 2",
      "afterEach"
    ];

    t.beforeEach( function( t ) {
      actual.push( "beforeEach 1" );
      t.skip();
    } );

    t.beforeEach( function() {
      actual.push( "beforeEach 2" );
      throw new Error( "Error" );
    } );

    t.test( function() {
      /* istanbul ignore next */
      actual.push( "don't run" );
    } );

    t.afterEach( function() {
      actual.push( "afterEach" );
    } );

    return runner.run().then( function() {
      assert.deepEqual( actual, expected );
      assert.strictEqual( results.length, 8 );
      assert.strictEqual( results[ 5 ].skipReason, undefined );
      assert.strictEqual( results[ 5 ].status, "failed" );
      assert.strictEqual( results.pop().status, "failed" );
    } );

  } );

  it( "error in beforeEach causes other tests to be skipped", () => {

    assert.expect( 2 );

    let runner = unit.Runner.init();
    let results = runner.listen();
    let test = runner.test;

    let actual = [];
    let expected = [
      "beforeEach",
      "beforeEach 2",
      "afterEach"
    ];

    test.beforeEach( function() {
      actual.push( "beforeEach" );
      throw new Error( "Error" );
    } );

    test.beforeEach( function() {
      actual.push( "beforeEach 2" );
    } );

    test( function() {
      /* istanbul ignore next */
      actual.push( "dont run" );
    } );

    test.group( () => {
      test.before( () => {
        /* istanbul ignore next */
        actual.push( "dont run" );
      } );
      test.beforeEach( () => {
        /* istanbul ignore next */
        actual.push( "dont run" );
      } );
      test( () => {
        /* istanbul ignore next */
        actual.push( "dont run" );
      } );
    } );

    test( function() {
      /* istanbul ignore next */
      actual.push( "dont run" );
    } );

    test.afterEach( function() {
      actual.push( "afterEach" );
    } );

    return runner.run().then( function() {
      assert.deepEqual( actual, expected );
      assert.strictEqual( results.pop().status, "failed" );
    } );

  } );

  it( "error in beforeEach does not skip tests in outer suites", () => {

    assert.expect( 2 );

    let runner = unit.Runner.init();
    let results = runner.listen();
    let test = runner.test;

    let actual = [];
    let expected = [
      "beforeEach",
      "beforeEach 2",
      "afterEach 2",
      "afterEach",
      "beforeEach",
      "beforeEach 3",
      "inner test",
      "afterEach",
      "beforeEach",
      "test",
      "afterEach"
    ];

    test.beforeEach( "beforeEach", () => {
      actual.push( "beforeEach" );
    } );

    test.group( "group 1", () => {
      test.beforeEach( "beforeEach 2", () => {
        actual.push( "beforeEach 2" );
        throw new Error( "Error" );
      } );
      test.serial( () => {
        /* istanbul ignore next */
        actual.push( "dont run" );
      } );
      test( () => {
        /* istanbul ignore next */
        actual.push( "dont run" );
      } );
      test( () => {
        /* istanbul ignore next */
        actual.push( "dont run" );
      } );
      test.afterEach( () => {
        actual.push( "afterEach 2" );
      } );
    } );

    test.group( "group 2", () => {
      test.beforeEach( "beforeEach 3", () => {
        actual.push( "beforeEach 3" );
      } );
      test( () => {
        actual.push( "inner test" );
      } );
    } );

    test( "test", () => {
      actual.push( "test" );
    } );

    test.afterEach( "afterEach", () => {
      actual.push( "afterEach" );
    } );

    return runner.run().then( function() {
      assert.deepEqual( actual, expected );
      assert.strictEqual( results.pop().status, "failed" );
    } );

  } );

  it( "error in beforeEach skips tests in the suite it was defined and in subsuites", () => {

    assert.expect( 2 );

    let runner = unit.Runner.init();
    let results = runner.listen();
    let test = runner.test;

    let actual = [];
    let expected = [
      "beforeEach",
      "afterEach"
    ];

    test.beforeEach( function() {
      actual.push( "beforeEach" );
      throw new Error( "Error" );
    } );

    test.group( () => {
      test.serial( () => {
        /* istanbul ignore next */
        actual.push( "dont run" );
      } );
      test( () => {
        /* istanbul ignore next */
        actual.push( "dont run" );
      } );
      test( () => {
        /* istanbul ignore next */
        actual.push( "dont run" );
      } );
    } );

    test( function() {
      /* istanbul ignore next */
      actual.push( "dont run" );
    } );

    test.afterEach( function() {
      actual.push( "afterEach" );
    } );

    return runner.run().then( function() {
      assert.deepEqual( actual, expected );
      assert.strictEqual( results.pop().status, "failed" );
    } );

  } );

  it( "error in beforeEach skips tests in the suite it was defined and in subsuites even if succeded before", () => {

    assert.expect( 2 );

    let runner = unit.Runner.init();
    let results = runner.listen();
    let test = runner.test;
    let count = 0;

    let actual = [];
    let expected = [
      "beforeEach",
      "beforeEach 2",
      "afterEach",
      "beforeEach",
      "test 1",
      "afterEach",
      "beforeEach",
      "afterEach"
    ];

    test.beforeEach( function() {
      actual.push( "beforeEach" );
      if ( count > 1 ) {
        throw new Error( "Error" );
      }
      count++;
    } );

    test.group( () => {
      test.beforeEach( function() {
        actual.push( "beforeEach 2" );
        throw new Error( "Error" );
      } );
      test( () => {
        /* istanbul ignore next */
        actual.push( "dont run" );
      } );
    } );

    test( function() {
      actual.push( "test 1" );
    } );

    test.group( () => {
      test( () => {
        /* istanbul ignore next */
        actual.push( "dont run" );
      } );
    } );

    test( () => {
      /* istanbul ignore next */
      actual.push( "dont run" );
    } );

    test.afterEach( function() {
      actual.push( "afterEach" );
    } );

    return runner.run().then( function() {
      assert.deepEqual( actual, expected );
      assert.strictEqual( results.pop().status, "failed" );
    } );

  } );

  it( "error in afterEach causes other tests to be skipped", () => {

    assert.expect( 2 );

    let runner = unit.Runner.init();
    let results = runner.listen();
    let test = runner.test;

    let actual = [];
    let expected = [
      "beforeEach",
      "beforeEach 2",
      "inner test",
      "afterEach 2",
      "afterEach",
      "beforeEach",
      "outer test",
      "afterEach"
    ];

    test.beforeEach( function() {
      actual.push( "beforeEach" );
    } );

    test.group( () => {
      test.beforeEach( () => {
        actual.push( "beforeEach 2" );
      } );
      test( () => {
        actual.push( "inner test" );
      } );
      test.afterEach( () => {
        actual.push( "afterEach 2" );
        throw new Error( "Error" );
      } );
      test( () => {
        /* istanbul ignore next */
        actual.push( "dont run" );
      } );
    } );

    test( function() {
      actual.push( "outer test" );
    } );

    test.afterEach( function() {
      actual.push( "afterEach" );
    } );

    return runner.run().then( function() {
      assert.deepEqual( actual, expected );
      assert.strictEqual( results.pop().status, "failed" );
    } );

  } );

  it( "error in afterEach skips tests in the suite it was defined and in subsuites", () => {

    assert.expect( 2 );

    let runner = unit.Runner.init();
    let results = runner.listen();
    let test = runner.test;

    let actual = [];
    let expected = [
      "beforeEach",
      "test",
      "afterEach"
    ];

    test.beforeEach( function() {
      actual.push( "beforeEach" );
    } );

    test.group( () => {
      test.serial( () => {
        actual.push( "test" );
      } );
      test( () => {
        /* istanbul ignore next */
        actual.push( "dont run" );
      } );
      test( () => {
        /* istanbul ignore next */
        actual.push( "dont run" );
      } );
    } );

    test( function() {
      /* istanbul ignore next */
      actual.push( "dont run" );
    } );

    test.afterEach( function() {
      actual.push( "afterEach" );
      throw new Error( "Error" );
    } );

    return runner.run().then( function() {
      assert.deepEqual( actual, expected );
      assert.strictEqual( results.pop().status, "failed" );
    } );

  } );

  it( "error in afterEach skips tests in the suite it was defined and in subsuites even if succeded before", () => {

    assert.expect( 2 );

    let runner = unit.Runner.init();
    let results = runner.listen();
    let test = runner.test;
    let count = 0;

    let actual = [];
    let expected = [
      "beforeEach",
      "test",
      "afterEach",
      "beforeEach",
      "test 2",
      "afterEach",
      "after"
    ];

    test.beforeEach( function() {
      actual.push( "beforeEach" );
    } );

    test.group( () => {
      test.serial( () => {
        actual.push( "test" );
      } );
      test( () => {
        actual.push( "test 2" );
      } );
    } );

    test( () => {
      /* istanbul ignore next */
      actual.push( "dont run" );
    } );

    test.afterEach( () => {
      actual.push( "afterEach" );
      if ( count > 0 ) {
        throw new Error( "Error" );
      }
      count++;
    } );

    test.after( () => {
      actual.push( "after" );
    } );

    return runner.run().then( function() {
      assert.deepEqual( actual, expected );
      assert.strictEqual( results.pop().status, "failed" );
    } );

  } );

  it( "skip in after hook", () => {

    assert.expect( 4 );

    let runner = unit.Runner.init();
    let results = runner.listen();
    let t = runner.test;

    let actual = [];
    let expected = [
      "before",
      "test",
      "after"
    ];

    t.before( function() {
      actual.push( "before" );
    } );

    t.test( function() {
      actual.push( "test" );
    } );

    t.after( function( t ) {
      actual.push( "after" );
      t.skip();
    } );

    return runner.run().then( function() {
      assert.deepEqual( actual, expected );
      assert.strictEqual( results.length, 16 );
      assert.strictEqual( results[ 13 ].status, "skipped" );
      assert.strictEqual( results.pop().status, "passed" );
    } );

  } );

  it( "skip in afterEach hook", () => {

    assert.expect( 3 );

    let runner = unit.Runner.init();
    let results = runner.listen();
    let t = runner.test;

    let actual = [];
    let expected = [
      "beforeEach",
      "test",
      "afterEach"
    ];

    t.beforeEach( function() {
      actual.push( "beforeEach" );
    } );

    t.test( function() {
      actual.push( "test" );
    } );

    t.afterEach( function( t ) {
      actual.push( "afterEach" );
      t.skip();
    } );

    return runner.run().then( function() {
      assert.deepEqual( actual, expected );
      assert.strictEqual( results.length, 8 );
      assert.strictEqual( results.pop().status, "passed" );
    } );

  } );

  it( "error in serial sequence does not affect concurrent sequence", () => {

    assert.expect( 2 );

    let runner = unit.Runner.init();
    let results = runner.listen();
    let test = runner.test;

    let actual = [];
    let expected = [
      "beforeEach",
      "serial",
      "afterEach",
      "beforeEach",
      "concurrent",
      "afterEach"
    ];

    test.beforeEach( function() {
      actual.push( "beforeEach" );
    } );

    test.group( () => {
      test.serial( () => {
        actual.push( "serial" );
        throw new Error( "error" );
      } );
      test( () => {
        actual.push( "concurrent" );
      } );
    } );

    test.afterEach( function() {
      actual.push( "afterEach" );
    } );

    return runner.run().then( function() {
      assert.deepEqual( actual, expected );
      assert.strictEqual( results.pop().status, "failed" );
    } );

  } );

} );
