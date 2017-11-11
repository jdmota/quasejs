import { Runner } from "../../src";
import assert from "../../../assert";

describe( "unit", () => {

  it( "context", () => {

    assert.expect( 12 );

    let runner = Runner.init();
    let results = runner.listen();
    let t = runner.test;
    let runCount = 0;

    t.before( function( a, context ) {
      assert.ok( !context.ran );
      assert.ok( !context.shared );
      context.ran = true;
      runCount++;
    } );

    t.after( function( a, context ) {
      assert.ok( !context.ran );
      assert.ok( !context.shared );
      context.ran = true;
      runCount++;
    } );

    t.beforeEach( function( a, context ) {
      assert.ok( !context.ran );
      assert.ok( !context.shared );
      context.ran = true;
      context.shared = true;
      runCount++;
    } );

    t.afterEach( function( a, context ) {
      assert.ok( context.ran );
      assert.ok( context.shared );
      runCount++;
    } );

    t( function( a, context ) {
      assert.ok( context.ran );
      assert.ok( context.shared );
      runCount++;
    } );

    return runner.run().then( function() {
      assert.strictEqual( runCount, 5 );
      assert.strictEqual( results.pop().status, "passed" );
    } );

  } );

  it( "context in nested groups", () => {

    assert.expect( 24 );

    let runner = Runner.init();
    let results = runner.listen();
    let t = runner.test;
    let runCount = 0;

    t.before( function( a, context ) {
      assert.ok( !context.ran );
      assert.ok( !context.shared );
      context.ran = true;
      runCount++;
    } );

    t.after( function( a, context ) {
      assert.ok( !context.ran );
      assert.ok( !context.shared );
      context.ran = true;
      runCount++;
    } );

    t.beforeEach( function( a, context ) {
      assert.ok( !context.ran );
      assert.ok( !context.shared );
      assert.ok( !context.count );
      context.ran = true;
      context.shared = true;
      context.count = 1;
      runCount++;
    } );

    t.group( function() {

      t.group( function() {

        t( function( a, context ) {
          assert.ok( context.ran );
          assert.ok( context.shared );
          assert.strictEqual( context.count, 1 );
          context.count++;
          runCount++;
        } );

      } );

      t( function( a, context ) {
        assert.ok( context.ran );
        assert.ok( context.shared );
        assert.strictEqual( context.count, 1 );
        context.count++;
        runCount++;
      } );

    } );

    t.afterEach( function( a, context ) {
      assert.ok( context.ran );
      assert.ok( context.shared );
      assert.strictEqual( context.count, 2 );
      runCount++;
    } );

    return runner.run().then( function() {
      assert.strictEqual( runCount, 8 );
      assert.strictEqual( results.pop().status, "passed" );
    } );

  } );

} );
