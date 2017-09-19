import unit from "../src";
import assert from "../../assert";

describe( "unit", () => {

  it( "test retries", () => {

    assert.expect( 4 );

    const runner = unit.Runner.init();
    const results = runner.listen();
    const test = runner.test;

    const actual = [];
    const expected = [
      "test",
      "test"
    ];

    test( "test", t => {
      t.retries( 1 );
      actual.push( "test" );
      throw new Error( "error" );
    } );

    return runner.run().then( () => {
      assert.deepEqual( actual, expected );
      assert.strictEqual( results[ 5 ].errors[ 0 ].message, "error" );
      assert.strictEqual( results[ 5 ].errors.length, 1 );
      assert.strictEqual( results.pop().status, "failed" );
    } );

  } );

  it( "test retries with delay", () => {

    assert.expect( 5 );

    const runner = unit.Runner.init();
    const results = runner.listen();
    const test = runner.test;

    const times = [];

    test( "test", t => {
      t.retries( 1 );
      t.retryDelay( 100 );
      times.push( Date.now() );
      throw new Error( "error" );
    } );

    return runner.run().then( () => {
      assert.strictEqual( times.length, 2 );
      assert.ok( times[ 1 ] - times[ 0 ] >= 100 );
      assert.strictEqual( results[ 5 ].errors[ 0 ].message, "error" );
      assert.strictEqual( results[ 5 ].errors.length, 1 );
      assert.strictEqual( results.pop().status, "failed" );
    } );

  } );

  it( "test retries inherit value from group", () => {

    assert.expect( 2 );

    const runner = unit.Runner.init();
    const results = runner.listen();
    const test = runner.test;

    const actual = [];
    const expected = [
      "test",
      "test"
    ];

    test.group( t => {

      t.retries( 1 );

      test( "test", () => {
        actual.push( "test" );
        throw new Error( "error" );
      } );

    } );

    return runner.run().then( () => {
      assert.deepEqual( actual, expected );
      assert.strictEqual( results.pop().status, "failed" );
    } );

  } );

  it( "hooks are also run when retrying", () => {

    assert.expect( 2 );

    const runner = unit.Runner.init();
    const results = runner.listen();
    const test = runner.test;

    const actual = [];
    const expected = [
      "beforeEach",
      "test",
      "afterEach",
      "beforeEach",
      "test",
      "afterEach"
    ];

    test.beforeEach( () => {
      actual.push( "beforeEach" );
    } );

    test.group( t => {

      t.retries( 1 );

      test( "test", () => {
        actual.push( "test" );
        throw new Error( "error" );
      } );

    } );

    test.afterEach( () => {
      actual.push( "afterEach" );
    } );

    return runner.run().then( () => {
      assert.deepEqual( actual, expected );
      assert.strictEqual( results.pop().status, "failed" );
    } );

  } );

  it( "dont retry if beforeEach failed", () => {

    assert.expect( 2 );

    const runner = unit.Runner.init();
    const results = runner.listen();
    const test = runner.test;

    const actual = [];
    const expected = [
      "beforeEach",
      "afterEach"
    ];

    test.beforeEach( () => {
      actual.push( "beforeEach" );
      throw new Error( "error" );
    } );

    test.group( t => {

      t.retries( 1 );

      test( () => {
        /* istanbul ignore next */
        actual.push( "dont run" );
      } );

    } );

    test.afterEach( () => {
      actual.push( "afterEach" );
    } );

    return runner.run().then( () => {
      assert.deepEqual( actual, expected );
      assert.strictEqual( results.pop().status, "failed" );
    } );

  } );

  it( "dont retry if afterEach failed", () => {

    assert.expect( 2 );

    const runner = unit.Runner.init();
    const results = runner.listen();
    const test = runner.test;

    const actual = [];
    const expected = [
      "beforeEach",
      "test",
      "afterEach"
    ];

    test.beforeEach( () => {
      actual.push( "beforeEach" );
    } );

    test.group( t => {

      t.retries( 1 );

      test( "test", () => {
        actual.push( "test" );
      } );

    } );

    test.afterEach( () => {
      actual.push( "afterEach" );
      throw new Error( "error" );
    } );

    return runner.run().then( () => {
      assert.deepEqual( actual, expected );
      assert.strictEqual( results.pop().status, "failed" );
    } );

  } );

  it( "calling .retries() again makes no difference", () => {

    assert.expect( 4 );

    const runner = unit.Runner.init();
    const results = runner.listen();
    const test = runner.test;

    const actual = [];
    const expected = [
      "test",
      "test retry"
    ];

    let count = 0;

    test( "test", t => {
      t.retries( 1 );
      if ( count++ === 0 ) {
        actual.push( "test" );
      } else {
        t.retries( 10 );
        actual.push( "test retry" );
      }
      throw new Error( "error" );
    } );

    return runner.run().then( () => {
      assert.deepEqual( actual, expected );
      assert.strictEqual( results[ 5 ].errors[ 0 ].message, "error" );
      assert.strictEqual( results[ 5 ].errors.length, 1 );
      assert.strictEqual( results.pop().status, "failed" );
    } );

  } );

  it( "mark as skipped if called t.skip() in second run", () => {

    assert.expect( 2 );

    const runner = unit.Runner.init();
    const results = runner.listen();
    const test = runner.test;

    const actual = [];
    const expected = [
      "beforeEach",
      "test",
      "afterEach",
      "beforeEach",
      "test",
      "afterEach"
    ];

    let count = 0;

    test.beforeEach( () => {
      actual.push( "beforeEach" );
    } );

    test.group( t => {

      t.retries( 1 );

      test( "test", t => {
        actual.push( "test" );
        if ( count++ === 0 ) {
          throw new Error( "error" );
        } else {
          t.skip();
        }
      } );

    } );

    test.afterEach( () => {
      actual.push( "afterEach" );
    } );

    return runner.run().then( () => {
      assert.deepEqual( actual, expected );
      assert.strictEqual( results.pop().status, "skipped" );
    } );

  } );

  it( "mark as skipped if called t.skip() (inside beforeEach) in second run", () => {

    assert.expect( 2 );

    const runner = unit.Runner.init();
    const results = runner.listen();
    const test = runner.test;

    const actual = [];
    const expected = [
      "beforeEach",
      "test",
      "afterEach",
      "beforeEach",
      "afterEach"
    ];

    let count = 0;

    test.beforeEach( t => {
      actual.push( "beforeEach" );
      if ( count !== 0 ) {
        t.skip();
      }
    } );

    test.group( t => {

      t.retries( 1 );

      test( "test", () => {
        actual.push( "test" );
        if ( count++ === 0 ) {
          throw new Error( "error" );
        }
      } );

    } );

    test.afterEach( () => {
      actual.push( "afterEach" );
    } );

    return runner.run().then( () => {
      assert.deepEqual( actual, expected );
      assert.strictEqual( results.pop().status, "skipped" );
    } );

  } );

  it( ".retries() not available for hooks", () => {

    assert.expect( 2 );

    const runner = unit.Runner.init();
    const results = runner.listen();
    const test = runner.test;

    const actual = [];
    const expected = [];

    test.beforeEach( t => {
      t.retries( 10 );
    } );

    test( () => {
      /* istanbul ignore next */
      actual.push( "dont run" );
    } );

    return runner.run().then( () => {
      assert.deepEqual( actual, expected );
      assert.strictEqual( results[ 5 ].errors[ 0 ].message, ".retries() is not available for hooks" );
    } );

  } );

  it( ".retryDelay() not available for hooks", () => {

    assert.expect( 2 );

    const runner = unit.Runner.init();
    const results = runner.listen();
    const test = runner.test;

    const actual = [];
    const expected = [];

    test.beforeEach( t => {
      t.retryDelay( 10 );
    } );

    test( () => {
      /* istanbul ignore next */
      actual.push( "dont run" );
    } );

    return runner.run().then( () => {
      assert.deepEqual( actual, expected );
      assert.strictEqual( results[ 5 ].errors[ 0 ].message, ".retryDelay() is not available for hooks" );
    } );

  } );

  it( "throw when retryDelay value is not number - group", () => {

    const runner = unit.Runner.init();
    const test = runner.test;

    assert.throws( () => {
      test.group( t => {
        t.retryDelay( "abc" );
      } );
    }, /Expected a number but saw/ );

  } );

  it( "throw when retryDelay value is too big - group", () => {

    const runner = unit.Runner.init();
    const test = runner.test;

    assert.throws( () => {
      test.group( t => {
        t.retryDelay( 2 ** 31 + 1 );
      } );
    }, /2147483649 is too big of a delay value/ );

  } );

} );
