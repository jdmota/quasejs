import { Runner } from "../../src";
import assert from "../../../assert";

describe( "unit", () => {

  it( "test timeout", () => {

    assert.expect( 6 );

    let runner = Runner.init( {
      timeout: 3000,
      allowNoPlan: true
    } );
    let results = runner.listen();
    let test = runner.test;
    let counts = 0;

    test( "test", function( t ) {
      t.timeout( 1 );
      assert.strictEqual( t.timeout(), 1 );
      return new Promise( function( resolve ) {
        setTimeout( resolve, 100 );
      } ).then( () => counts++ );
    } );

    return runner.run().then( function() {
      assert.strictEqual( counts, 0, "If the timeout exceeds, end the test." );
      assert.strictEqual( results[ 5 ].status, "failed" );
      assert.strictEqual( results[ 5 ].errors[ 0 ].message, "Timeout exceeded." );
      assert.ok( results[ 5 ].errors[ 0 ].stack );
      assert.strictEqual( results.pop().status, "failed" );
    } );

  } );

  it( "test timeout inside group", () => {

    assert.expect( 5 );

    let runner = Runner.init( { allowNoPlan: true } );
    let results = runner.listen();
    let test = runner.test;
    let counts = 0;

    test.group( function( t ) {

      t.timeout( 1 );

      test( "test", function( t ) {
        assert.strictEqual( t.timeout(), 1 );
        return new Promise( function( resolve ) {
          setTimeout( resolve, 100 );
        } ).then( () => counts++ );
      } );

    } );

    return runner.run().then( function() {
      assert.strictEqual( counts, 0, "If the timeout exceeds, end the test." );
      assert.strictEqual( results[ 7 ].status, "failed" );
      assert.strictEqual( results[ 7 ].errors[ 0 ].message, "Timeout exceeded." );
      assert.strictEqual( results.pop().status, "failed" );
    } );

  } );

  it( "test timeout inside group (override)", () => {

    assert.expect( 3 );

    let runner = Runner.init( {
      timeout: 1,
      allowNoPlan: true
    } );
    let results = runner.listen();
    let test = runner.test;
    let counts = 0;

    test.group( function( t ) {

      t.timeout( 3000 );

      test( "test", function() {
        return new Promise( function( resolve ) {
          setTimeout( resolve, 10 );
        } ).then( () => counts++ );
      } );

    } );

    return runner.run().then( function() {
      assert.strictEqual( counts, 1 );
      assert.strictEqual( results[ 7 ].status, "passed" );
      assert.strictEqual( results.pop().status, "passed" );
    } );

  } );

  it( "test timeout of zero disables", () => {

    assert.expect( 6 );

    let runner = Runner.init( { allowNoPlan: true } );
    let results = runner.listen();
    let test = runner.test;
    let counts = 0;

    test.group( t => {

      assert.strictEqual( t.timeout(), 0 );

      t.timeout( 2 );

      assert.strictEqual( t.timeout(), 2 );

      test( "test", t => {
        t.timeout( 0 );
        assert.strictEqual( t.timeout(), 0 );
        return new Promise( resolve => {
          setTimeout( resolve, 100 );
        } ).then( () => counts++ );
      } );

    } );

    return runner.run().then( () => {
      assert.strictEqual( counts, 1 );
      assert.strictEqual( results[ 7 ].status, "passed" );
      assert.strictEqual( results.pop().status, "passed" );
    } );

  } );

  it( "test timeout of zero disables 2", () => {

    assert.expect( 3 );

    let runner = Runner.init( {
      timeout: 2,
      allowNoPlan: true
    } );
    let results = runner.listen();
    let test = runner.test;
    let counts = 0;

    test.group( function( t ) {

      t.timeout( 0 );

      test( "test", function() {
        return new Promise( function( resolve ) {
          setTimeout( resolve, 100 );
        } ).then( () => counts++ );
      } );

    } );

    return runner.run().then( function() {
      assert.strictEqual( counts, 1 );
      assert.strictEqual( results[ 7 ].status, "passed" );
      assert.strictEqual( results.pop().status, "passed" );
    } );

  } );

  it( "throw when timeout value is not number - group", () => {

    let runner = Runner.init( { allowNoPlan: true } );
    let test = runner.test;

    assert.throws( () => {
      test.group( t => {
        t.timeout( "abc" );
      } );
    }, /Expected a number but saw/ );

  } );

  it( "throw when timeout value is too big - group", () => {

    let runner = Runner.init( { allowNoPlan: true } );
    let test = runner.test;

    assert.throws( () => {
      test.group( t => {
        t.timeout( 2 ** 31 + 1 );
      } );
    }, /2147483649 is too big of a timeout value/ );

  } );

} );
