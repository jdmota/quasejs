import Runner from "../../src/core/runner";
import assert from "../../../assert";

describe( "unit", () => {

  it( "fast bail is off by default", () => {

    assert.expect( 2 );

    let runner = Runner.init( { allowNoPlan: true } );
    let results = runner.listen();
    let test = runner.test;

    let actual = [];
    let expected = [
      "test",
      "bail",
      "test2"
    ];

    test( function() {
      actual.push( "test" );
    } );

    test( function() {
      actual.push( "bail" );
      throw new Error( "Error" );
    } );

    test( function() {
      actual.push( "test2" );
    } );

    return runner.run().then( function() {
      assert.deepEqual( actual, expected );
      assert.strictEqual( results.pop().status, "failed" );
    } );

  } );

  it( "fast bail", () => {

    assert.expect( 2 );

    let runner = Runner.init( {
      bail: true,
      allowNoPlan: true
    } );
    let results = runner.listen();
    let test = runner.test;

    let actual = [];
    let expected = [
      "before",
      "test",
      "bail",
      "after"
    ];

    test.before( function() {
      actual.push( "before" );
    } );

    test( function() {
      actual.push( "test" );
    } );

    test( function() {
      actual.push( "bail" );
      throw new Error( "Error" );
    } );

    test.group( () => {
      test.before( () => {
        /* istanbul ignore next */
        actual.push( "dont run" );
      } );
      test( () => {
        /* istanbul ignore next */
        actual.push( "dont run" );
      } );
    } );

    test.group( () => {
      test.before( () => {
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

    test.after( function() {
      actual.push( "after" );
    } );

    return runner.run().then( function() {
      assert.deepEqual( actual, expected );
      assert.strictEqual( results.pop().status, "failed" );
    } );

  } );

  it( "fast bail - error in before", () => {

    assert.expect( 2 );

    let runner = Runner.init( {
      bail: true,
      allowNoPlan: true
    } );
    let results = runner.listen();
    let test = runner.test;

    let actual = [];
    let expected = [
      "before",
      "before 2",
      "after"
    ];

    test.before( function() {
      actual.push( "before" );
      throw new Error( "Error" );
    } );

    test.before( function() {
      actual.push( "before 2" );
    } );

    test( function() {
      /* istanbul ignore next */
      actual.push( "dont run" );
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
      test( () => {
        /* istanbul ignore next */
        actual.push( "dont run" );
      } );
    } );

    test.group( () => {
      test.before( () => {
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

    test.after( function() {
      actual.push( "after" );
    } );

    return runner.run().then( function() {
      assert.deepEqual( actual, expected );
      assert.strictEqual( results.pop().status, "failed" );
    } );

  } );

  it( "fast bail in group", () => {

    assert.expect( 2 );

    let runner = Runner.init( { allowNoPlan: true } );
    let results = runner.listen();
    let test = runner.test;

    let actual = [];
    let expected = [
      "test",
      "bail"
    ];

    test.group.bail( function() {

      test( function() {
        actual.push( "test" );
      } );

      test( function() {
        actual.push( "bail" );
        throw new Error( "Error" );
      } );

      test( function() {
        /* istanbul ignore next */
        actual.push( "dont run" );
      } );

    } );

    return runner.run().then( function() {
      assert.deepEqual( actual, expected );
      assert.strictEqual( results.pop().status, "failed" );
    } );

  } );

  it( "fast bail - error in beforeEach", () => {

    assert.expect( 2 );

    let runner = Runner.init( {
      bail: true,
      allowNoPlan: true
    } );
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

  it( "fast bail in group", () => {

    assert.expect( 2 );

    let runner = Runner.init( { allowNoPlan: true } );
    let results = runner.listen();
    let test = runner.test;

    let actual = [];
    let expected = [
      "test",
      "bail"
    ];

    test.group.bail( function() {

      test( function() {
        actual.push( "test" );
      } );

      test( function() {
        actual.push( "bail" );
        throw new Error( "Error" );
      } );

      test( function() {
        /* istanbul ignore next */
        actual.push( "dont run" );
      } );

    } );

    return runner.run().then( function() {
      assert.deepEqual( actual, expected );
      assert.strictEqual( results.pop().status, "failed" );
    } );

  } );

  it( "fast bail in group with async code", () => {

    assert.expect( 2 );

    function timeout() {
      return new Promise( function( resolve ) {
        setTimeout( resolve, 5 );
      } );
    }

    let runner = Runner.init( { allowNoPlan: true } );
    let results = runner.listen();
    let test = runner.test;

    let actual = [];
    let expected = [
      "test 1",
      "test 2"
    ];

    test.group.bail( function() {

      test.serial( function() {
        actual.push( "test 1" );
        return timeout();
      } );

      test.serial( function() {
        actual.push( "test 2" );
        return timeout().then( function() {
          throw new Error( "Error" );
        } );
      } );

      test.serial( function() {
        /* istanbul ignore next */
        actual.push( "dont run" );
      } );

    } );

    return runner.run().then( function() {
      assert.deepEqual( actual, expected );
      assert.strictEqual( results.pop().status, "failed" );
    } );

  } );

  it( "error in serial sequence stops concurrent sequence", () => {

    assert.expect( 2 );

    let runner = Runner.init( { allowNoPlan: true } );
    let results = runner.listen();
    let test = runner.test;

    let actual = [];
    let expected = [
      "beforeEach",
      "serial",
      "afterEach"
    ];

    test.beforeEach( function() {
      actual.push( "beforeEach" );
    } );

    test.group.bail( () => {
      test.serial( () => {
        actual.push( "serial" );
        throw new Error( "error" );
      } );
      test( () => {
        /* istanbul ignore next */
        actual.push( "dont run" );
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

  it( "skipped test remains skipped", () => {

    assert.expect( 3 );

    const runner = Runner.init( {
      bail: true,
      allowNoPlan: true
    } );
    const results = runner.listen();
    const test = runner.test;

    const actual = [];
    const expected = [
      "bail"
    ];

    test( () => {
      actual.push( "bail" );
      throw new Error( "Error" );
    } );

    test.skip( () => {
      /* istanbul ignore next */
      actual.push( "dont run 1" );
    } );

    test( () => {
      /* istanbul ignore next */
      actual.push( "dont run 2" );
    } );

    return runner.run().then( function() {
      assert.deepEqual( actual, expected );
      assert.strictEqual( results[ results.length - 1 ].status, "failed" );
      assert.deepEqual( results[ results.length - 1 ].testCounts, {
        failed: 1,
        skipped: 2,
        passed: 0,
        todo: 0,
        total: 3
      } );
    } );

  } );

  it( "skipped group remains skipped", () => {

    assert.expect( 3 );

    const runner = Runner.init( {
      bail: true,
      allowNoPlan: true
    } );
    const results = runner.listen();
    const test = runner.test;

    const actual = [];
    const expected = [
      "bail"
    ];

    test( () => {
      actual.push( "bail" );
      throw new Error( "Error" );
    } );

    test.group.skip( () => {
      test( () => {
        /* istanbul ignore next */
        actual.push( "dont run 1" );
      } );

      test( () => {
        /* istanbul ignore next */
        actual.push( "dont run 2" );
      } );
    } );

    return runner.run().then( function() {
      assert.deepEqual( actual, expected );
      assert.strictEqual( results[ results.length - 1 ].status, "failed" );
      assert.deepEqual( results[ results.length - 1 ].testCounts, {
        failed: 1,
        skipped: 2,
        passed: 0,
        todo: 0,
        total: 3
      } );
    } );

  } );

} );
