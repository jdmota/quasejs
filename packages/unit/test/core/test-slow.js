import { Runner } from "../../src";
import assert from "../../../assert";

describe( "unit", () => {

  it( "test slow", () => {

    assert.expect( 2 );

    let runner = Runner.init( {
      slow: 5000,
      allowNoPlan: true
    } );
    let results = runner.listen();
    let test = runner.test;

    test( "test", function( t ) {
      t.slow( 1 );
      return new Promise( function( resolve ) {
        setTimeout( resolve, 100 );
      } );
    } );

    return runner.run().then( function() {
      assert.strictEqual( results[ 5 ].status, "passed" );
      assert.strictEqual( results[ 5 ].slow, true );
    } );

  } );

  it( "test slow inside group", () => {

    assert.expect( 2 );

    let runner = Runner.init( { allowNoPlan: true } );
    let results = runner.listen();
    let test = runner.test;

    test.group( function( t ) {

      t.slow( 1 );

      test( "test", function() {
        return new Promise( function( resolve ) {
          setTimeout( resolve, 100 );
        } );
      } );

    } );

    return runner.run().then( function() {
      assert.strictEqual( results[ 7 ].status, "passed" );
      assert.strictEqual( results[ 7 ].slow, true );
    } );

  } );

  it( "test slow inside group (override)", () => {

    assert.expect( 3 );

    let runner = Runner.init( {
      slow: 1,
      allowNoPlan: true
    } );
    let results = runner.listen();
    let test = runner.test;

    test.group( function( t ) {

      t.slow( 3000 );

      assert.strictEqual( t.slow(), 3000 );

      test( "test", function() {
        return new Promise( function( resolve ) {
          setTimeout( resolve, 10 );
        } );
      } );

    } );

    return runner.run().then( function() {
      assert.strictEqual( results[ 7 ].status, "passed" );
      assert.strictEqual( results[ 7 ].slow, false );
    } );

  } );

  it( "test slow of zero disables", () => {

    assert.expect( 3 );

    let runner = Runner.init( { allowNoPlan: true } );
    let results = runner.listen();
    let test = runner.test;

    test.group( function( t ) {

      t.slow( 1 );

      test( "test", function( t ) {
        t.slow( 0 );
        assert.strictEqual( t.slow(), 0 );
        return new Promise( function( resolve ) {
          setTimeout( resolve, 100 );
        } );
      } );

    } );

    return runner.run().then( function() {
      assert.strictEqual( results[ 7 ].status, "passed" );
      assert.strictEqual( results[ 7 ].slow, false );
    } );

  } );

  it( "test slow of zero disables 2", () => {

    assert.expect( 2 );

    let runner = Runner.init( {
      slow: 2,
      allowNoPlan: true
    } );
    let results = runner.listen();
    let test = runner.test;

    test.group( function( t ) {

      t.slow( 0 );

      test( "test", function() {
        return new Promise( function( resolve ) {
          setTimeout( resolve, 100 );
        } );
      } );

    } );

    return runner.run().then( function() {
      assert.strictEqual( results[ 7 ].status, "passed" );
      assert.strictEqual( results[ 7 ].slow, false );
    } );

  } );

  it( "t.slow() returns current value from parent suite", () => {

    assert.expect( 4 );

    let runner = Runner.init( { allowNoPlan: true } );
    let results = runner.listen();
    let test = runner.test;

    const g = test.group();

    assert.strictEqual( g.slow(), 0 );

    g.slow( 1000 );

    assert.strictEqual( g.slow(), 1000 );

    g.test( t => {
      assert.strictEqual( t.slow(), 1000 );
    } );

    return runner.run().then( () => {
      assert.strictEqual( results[ 11 ].status, "passed" );
    } );

  } );

  it( "t.slow() returns current value from runner", () => {

    assert.expect( 2 );

    let runner = Runner.init( {
      slow: 5000,
      allowNoPlan: true
    } );
    let results = runner.listen();
    let test = runner.test;

    test( "test", t => {
      assert.strictEqual( t.slow(), 5000 );
    } );

    return runner.run().then( () => {
      assert.strictEqual( results[ 5 ].status, "passed" );
    } );

  } );

} );
