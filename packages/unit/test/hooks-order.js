import unit from "../src";
import assert from "../../assert";

describe( "unit", () => {

  it( "hooks order", () => {

    assert.expect( 1 );

    let runner = unit.Runner.init();
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
      actual.push( "test" );
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

} );
