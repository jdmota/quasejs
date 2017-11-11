import { Runner } from "../../src";
import assert from "../../../assert";

describe( "unit", () => {

  it( "only", () => {

    assert.expect( 3 );

    let runner = Runner.init( { allowNoPlan: true } );
    let results = runner.listen();
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

    t.serial( function() {
      /* istanbul ignore next */
      actual.push( "dont run" );
    } );

    t( function() {
      /* istanbul ignore next */
      actual.push( "dont run" );
    } );

    t.group.only( function() {

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

      t.only( function() {
        actual.push( "group test" );
      } );

      t.failing.serial( function() {
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
      assert.strictEqual( results[ results.length - 1 ].onlyCount, 2 );
      assert.deepEqual( results[ results.length - 1 ].testCounts, {
        failed: 0,
        passed: 4,
        skipped: 0,
        todo: 0,
        total: 4
      } );
    } );

  } );

  it( "only - ignore group", () => {

    assert.expect( 3 );

    let runner = Runner.init( { allowNoPlan: true } );
    let results = runner.listen();
    let t = runner.test;

    let actual = [];
    let expected = [
      "only"
    ];

    t.only( function() {
      actual.push( "only" );
    } );

    t.group( function() {

      t( function() {
        /* istanbul ignore next */
        actual.push( "dont run" );
      } );

    } );

    return runner.run().then( function() {
      assert.deepEqual( actual, expected );
      assert.strictEqual( results[ results.length - 1 ].onlyCount, 1 );
      assert.deepEqual( results[ results.length - 1 ].testCounts, {
        failed: 0,
        passed: 1,
        skipped: 0,
        todo: 0,
        total: 1
      } );
    } );

  } );

} );
