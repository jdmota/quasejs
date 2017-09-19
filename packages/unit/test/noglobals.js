import unit from "../src";
import assert from "../../assert";

/* eslint no-console: 0 */
/* global window */

describe( "unit", () => {

  it( "noglobals", () => {

    assert.expect( 2 );

    let runner = unit.Runner.init( {
      noglobals: true
    } );
    let results = runner.listen();
    let test = runner.test;

    test( function() {

      if ( typeof global === "undefined" ) {
        /* istanbul ignore next */
        window.abc = 10;
      } else {
        global.abc = 10;
      }

    } );

    test.after( function() {} );

    return runner.run().then( function() {

      assert.strictEqual( results[ 5 ].errors[ 0 ].message, "Introduced global variable(s): abc" );
      assert.strictEqual( results.pop().status, "failed" );

      if ( typeof global === "undefined" ) {
        /* istanbul ignore next */
        delete window.abc;
      } else {
        delete global.abc;
      }

    } );

  } );

  it( "noglobals 2", () => {

    assert.expect( 2 );

    let runner = unit.Runner.init( {
      noglobals: true
    } );
    let results = runner.listen();
    let test = runner.test;

    test( function() {

      if ( typeof global === "undefined" ) {
        /* istanbul ignore next */
        delete window.abc;
      } else {
        delete global.abc;
      }

    } );

    test.after( function() {} );

    if ( typeof global === "undefined" ) {
      /* istanbul ignore next */
      window.abc = 10;
    } else {
      global.abc = 10;
    }

    return runner.run().then( function() {
      assert.strictEqual( results[ 5 ].errors[ 0 ].message, "Deleted global variable(s): abc" );
      assert.strictEqual( results.pop().status, "failed" );
    } );

  } );

  it( "noglobals 3", () => {

    assert.expect( 2 );

    let runner = unit.Runner.init( {
      noglobals: true
    } );
    let results = runner.listen();
    let test = runner.test;

    test( function() {

      if ( typeof global === "undefined" ) {
        /* istanbul ignore next */
        delete window.abc;
      } else {
        delete global.abc;
      }

      if ( typeof global === "undefined" ) {
        /* istanbul ignore next */
        window.cba = 10;
      } else {
        global.cba = 10;
      }

    } );

    test.after( function() {} );

    if ( typeof global === "undefined" ) {
      /* istanbul ignore next */
      window.abc = 10;
    } else {
      global.abc = 10;
    }

    return runner.run().then( function() {

      assert.strictEqual(
        results[ 5 ].errors[ 0 ].message,
        "Introduced global variable(s): cba; Deleted global variable(s): abc"
      );

      assert.strictEqual( results.pop().status, "failed" );

      if ( typeof global === "undefined" ) {
        delete window.cba;
      } else {
        /* istanbul ignore next */
        delete global.cba;
      }

    } );

  } );

  it( "noglobals - don't get tricked", () => {

    assert.expect( 2 );

    let runner = unit.Runner.init( {
      noglobals: true
    } );
    let results = runner.listen();
    let test = runner.test;

    test.serial( () => {
      if ( typeof global === "undefined" ) {
        /* istanbul ignore next */
        window.foo = 10;
      } else {
        global.foo = 10;
      }
    } );

    test.serial( () => {
      if ( typeof global === "undefined" ) {
        /* istanbul ignore next */
        delete window.foo;
      } else {
        delete global.foo;
      }
    } );

    return runner.run().then( function() {

      assert.strictEqual(
        results[ 5 ].errors[ 0 ].message,
        "Introduced global variable(s): foo"
      );

      assert.strictEqual( results.pop().status, "failed" );

    } );

  } );

} );
