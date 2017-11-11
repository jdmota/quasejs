import { Runner } from "../../src";
import assert from "../../../assert";

describe( "unit", () => {

  it( "skip", () => {

    assert.expect( 1 );

    let runner = Runner.init();
    let t = runner.test;

    let actual = [];
    let expected = [
      "group",
      "before",
      "beforeEach",
      "group beforeEach",
      "group beforeEach 2",
      "group test",
      "group afterEach",
      "group afterEach 2",
      "afterEach",
      "afterEach 2",
      "after",
      "after 2"
    ];

    t.before( function() {
      actual.push( "before" );
    } );

    t.after( function() {
      actual.push( "after" );
    } );

    t.after( function() {
      actual.push( "after 2" );
    } );

    t.beforeEach( function() {
      actual.push( "beforeEach" );
    } );

    t.skip( function() {
      /* istanbul ignore next */
      actual.push( "dont run" );
    } );

    t.skip( function() {
      /* istanbul ignore next */
      actual.push( "dont run" );
    } );

    t.group( function() {

      actual.push( "group" );

      t.beforeEach( function() {
        actual.push( "group beforeEach" );
      } );

      t.afterEach( function() {
        actual.push( "group afterEach" );
      } );

      t.beforeEach( function() {
        actual.push( "group beforeEach 2" );
      } );

      t.afterEach( function() {
        actual.push( "group afterEach 2" );
      } );

      t( function() {
        actual.push( "group test" );
      } );

      t.skip( function() {
        /* istanbul ignore next */
        actual.push( "dont run" );
      } );

      t.skip( function() {
        /* istanbul ignore next */
        actual.push( "dont run" );
      } );

    } );

    t.afterEach( function() {
      actual.push( "afterEach" );
    } );

    t.afterEach( function() {
      actual.push( "afterEach 2" );
    } );

    return runner.run().then( function() {
      assert.deepEqual( actual, expected );
    } );

  } );

  it( "skip works with groups", () => {

    assert.expect( 2 );

    let runner = Runner.init();
    let results = runner.listen();
    let t = runner.test;

    let actual = [];
    let expected = [
      "group",
      "before",
      "after",
      "after 2"
    ];

    t.before( function() {
      actual.push( "before" );
    } );

    t.after( function() {
      actual.push( "after" );
    } );

    t.after( function() {
      actual.push( "after 2" );
    } );

    t.beforeEach( function() {
      /* istanbul ignore next */
      actual.push( "beforeEach" );
    } );

    t.skip( function() {
      /* istanbul ignore next */
      actual.push( "dont run" );
    } );

    t.skip( function() {
      /* istanbul ignore next */
      actual.push( "dont run" );
    } );

    t.group.skip( function() {

      actual.push( "group" );

      t( function() {
        /* istanbul ignore next */
        actual.push( "dont run" );
      } );

      t( function() {
        /* istanbul ignore next */
        actual.push( "dont run" );
      } );

    } );

    t.afterEach( function() {
      /* istanbul ignore next */
      actual.push( "afterEach" );
    } );

    t.afterEach( function() {
      /* istanbul ignore next */
      actual.push( "afterEach 2" );
    } );

    return runner.run().then( function() {
      assert.deepEqual( actual, expected );
      assert.deepEqual( results.pop().testCounts, {
        failed: 0,
        passed: 3,
        skipped: 4,
        todo: 0,
        total: 7
      } );
    } );

  } );

  it( "skip in the test", () => {

    assert.expect( 3 );

    let runner = Runner.init();
    let results = runner.listen();
    let t = runner.test;

    let actual = [];
    let expected = [
      "test 1",
      "test 2"
    ];

    t( function() {
      actual.push( "test 1" );
    } );

    t( function( p ) {
      actual.push( "test 2" );
      p.skip( "reason for skipping" );
      /* istanbul ignore next */
      actual.push( "dont run after skip()" );
    } );

    return runner.run().then( function() {
      assert.deepEqual( actual, expected );
      assert.strictEqual( results[ 9 ].skipReason, "reason for skipping" );
      assert.deepEqual( results[ 11 ].testCounts, {
        failed: 0,
        passed: 1,
        skipped: 1,
        todo: 0,
        total: 2
      } );
    } );

  } );

  it( "skip inside Promise in the test", () => {

    assert.expect( 3 );

    let runner = Runner.init();
    let results = runner.listen();
    let t = runner.test;

    let actual = [];
    let expected = [
      "test 1",
      "test 2"
    ];

    t( function() {
      actual.push( "test 1" );
    } );

    t( function( p ) {
      actual.push( "test 2" );
      return new Promise( resolve => resolve() ).then( () => p.skip( "reason for skipping in promise" ) );
    } );

    return runner.run().then( function() {
      assert.deepEqual( actual, expected );
      assert.strictEqual( results[ 9 ].skipReason, "reason for skipping in promise" );
      assert.deepEqual( results[ 11 ].testCounts, {
        failed: 0,
        passed: 1,
        skipped: 1,
        todo: 0,
        total: 2
      } );
    } );

  } );

  it( "skip in the beforeHook", () => {

    assert.expect( 2 );

    let runner = Runner.init();
    let results = runner.listen();
    let t = runner.test;

    let actual = [];
    let expected = [
      "before",
      "after"
    ];

    t.before( function( p ) {
      actual.push( "before" );
      p.skip();
      /* istanbul ignore next */
      actual.push( "dont run after skip()" );
    } );

    t.after( function() {
      actual.push( "after" );
    } );

    t( function() {
      /* istanbul ignore next */
      actual.push( "dont run test" );
    } );

    return runner.run().then( function() {
      assert.deepEqual( actual, expected );
      assert.deepEqual( results[ 15 ].testCounts, {
        failed: 0,
        passed: 1,
        skipped: 2,
        todo: 0,
        total: 3
      } );
    } );

  } );

  it( "skip inside Promise in the beforeHook", () => {

    assert.expect( 2 );

    let runner = Runner.init();
    let results = runner.listen();
    let t = runner.test;

    let actual = [];
    let expected = [
      "before",
      "after"
    ];

    t.before( function( p ) {
      actual.push( "before" );
      return new Promise( resolve => resolve() ).then( () => p.skip() );
    } );

    t.after( function() {
      actual.push( "after" );
    } );

    t( function() {
      /* istanbul ignore next */
      actual.push( "dont run test" );
    } );

    return runner.run().then( function() {
      assert.deepEqual( actual, expected );
      assert.deepEqual( results[ 15 ].testCounts, {
        failed: 0,
        passed: 1,
        skipped: 2,
        todo: 0,
        total: 3
      } );
    } );

  } );

  it( "skip modifier in before hook should not affect tests", () => {

    assert.expect( 2 );

    let runner = Runner.init();
    let results = runner.listen();
    let t = runner.test;

    let actual = [];
    let expected = [
      "test",
      "after"
    ];

    t.skip.before( () => {
      /* istanbul ignore next */
      actual.push( "dont run" );
    } );

    t.after( () => {
      actual.push( "after" );
    } );

    t( () => {
      actual.push( "test" );
    } );

    return runner.run().then( () => {
      assert.deepEqual( actual, expected );
      assert.deepEqual( results.pop().testCounts, {
        failed: 0,
        passed: 2,
        skipped: 1,
        todo: 0,
        total: 3
      } );
    } );

  } );

} );
