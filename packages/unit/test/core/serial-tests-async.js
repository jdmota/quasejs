import { Runner } from "../../src";
import assert from "../../../assert";

describe( "unit", () => {

  it( "serial tests with async code", () => {

    assert.expect( 3 );

    let timeouts = 0;
    let called = 0;

    function timeout() {
      return new Promise( resolve => {
        timeouts++;
        setTimeout( resolve, 5 );
      } ).then( () => {
        called++;
      } );
    }

    let runner = Runner.init();
    let t = runner.test;

    let actual = [];
    let expected = [
      "group",
      "before",
      "beforeEach",
      "test",
      "afterEach",
      "afterEach 2",
      "beforeEach",
      "test 2",
      "afterEach",
      "afterEach 2",
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
      return timeout();
    } );

    t.after( function() {
      actual.push( "after" );
      return timeout();
    } );

    t.after( function() {
      actual.push( "after 2" );
    } );

    t.beforeEach( function() {
      actual.push( "beforeEach" );
      return timeout();
    } );

    t.serial( function() {
      actual.push( "test" );
      return timeout();
    } );

    t.serial( function() {
      actual.push( "test 2" );
      return timeout();
    } );

    t.group( function() {

      actual.push( "group" );

      t.beforeEach( function() {
        actual.push( "group beforeEach" );
      } );

      t.afterEach( function() {
        actual.push( "group afterEach" );
        return timeout();
      } );

      t.beforeEach( function() {
        actual.push( "group beforeEach 2" );
      } );

      t.afterEach( function() {
        actual.push( "group afterEach 2" );
      } );

      t( function() {
        actual.push( "group test" );
        return timeout();
      } );

    } );

    t.afterEach( function() {
      actual.push( "afterEach" );
    } );

    t.afterEach( function() {
      actual.push( "afterEach 2" );
      return timeout();
    } );

    return runner.run().then( function() {
      assert.deepEqual( actual, expected );
      assert.strictEqual( timeouts, 12 );
      assert.strictEqual( called, timeouts );
    } );

  } );

} );
