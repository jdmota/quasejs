import { Runner } from "../src";
import assert from "../../assert";

describe( "unit", () => {

  it( "hooks times", () => {

    assert.expect( 5 );

    let runner = Runner.init();
    let t = runner.test;

    let before = 0;
    let after = 0;
    let beforeEach = 0;
    let afterEach = 0;
    let test = 0;

    t.before( function() {
      before++;
    } );

    t.after( function() {
      after++;
    } );

    t.beforeEach( function() {
      beforeEach++;
    } );

    t( function() {
      test++;
    } );

    t.afterEach( function() {
      afterEach++;
    } );

    t( function() {
      test++;
    } );

    t( function() {
      test++;
    } );

    return runner.run().then( function() {
      assert.strictEqual( before, 1 );
      assert.strictEqual( after, 1 );
      assert.strictEqual( beforeEach, 3 );
      assert.strictEqual( afterEach, 3 );
      assert.strictEqual( test, 3 );
    } );

  } );

} );
