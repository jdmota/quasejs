import Runner from "../../src/core/runner";
import assert from "../../../assert";

describe( "unit", () => {

  it( "global force serial", () => {

    assert.expect( 4 );

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

    let runner = Runner.init( { forceSerial: true } );
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

    t.before( () => {
      actual.push( "before" );
      return timeout();
    } );

    t.after( () => {
      actual.push( "after" );
      return timeout();
    } );

    t.after( () => {
      actual.push( "after 2" );
    } );

    t.beforeEach( () => {
      actual.push( "beforeEach" );
      return timeout();
    } );

    t( () => {
      actual.push( "test" );
      return timeout();
    } );

    t( () => {
      actual.push( "test 2" );
      return timeout();
    } );

    t.group( group => {

      assert.strictEqual( group.forceSerial(), true );

      actual.push( "group" );

      t.beforeEach( () => {
        actual.push( "group beforeEach" );
      } );

      t.afterEach( () => {
        actual.push( "group afterEach" );
        return timeout();
      } );

      t.beforeEach( () => {
        actual.push( "group beforeEach 2" );
      } );

      t.afterEach( () => {
        actual.push( "group afterEach 2" );
      } );

      t( () => {
        actual.push( "group test" );
        return timeout();
      } );

    } );

    t.afterEach( () => {
      actual.push( "afterEach" );
    } );

    t.afterEach( () => {
      actual.push( "afterEach 2" );
      return timeout();
    } );

    return runner.run().then( () => {
      assert.deepEqual( actual, expected );
      assert.strictEqual( timeouts, 12 );
      assert.strictEqual( called, timeouts );
    } );

  } );

  it( "local force serial", () => {

    assert.expect( 5 );

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
      "group beforeEach",
      "group test",
      "group afterEach",
      "group beforeEach",
      "group test 2",
      "group afterEach",
    ];

    t.group( group => {

      assert.strictEqual( group.forceSerial(), false );
      group.forceSerial( true );
      assert.strictEqual( group.forceSerial(), true );

      actual.push( "group" );

      t.beforeEach( () => {
        actual.push( "group beforeEach" );
        return timeout();
      } );

      t.afterEach( () => {
        actual.push( "group afterEach" );
        return timeout();
      } );

      t( () => {
        actual.push( "group test" );
        return timeout();
      } );

      t( () => {
        actual.push( "group test 2" );
        return timeout();
      } );

    } );

    return runner.run().then( () => {
      assert.deepEqual( actual, expected );
      assert.strictEqual( timeouts, 6 );
      assert.strictEqual( called, timeouts );
    } );

  } );

} );
