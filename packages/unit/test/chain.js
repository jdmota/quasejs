import unit from "../src";
import assert from "../../assert";

describe( "unit", () => {

  it( "chain", () => {

    assert.expect( 1 );

    const runner = unit.Runner.init();
    const test = runner.test;

    const expected = [ "before", "test", "after" ];
    const actual = [];

    const t2 = test.before;
    const t3 = t2.after;

    t3( "after", function() {
      actual.push( "after" );
    } );

    t2.test( "test", function() {
      actual.push( "test" );
    } );

    t2( "before", function() {
      actual.push( "before" );
    } );

    return runner.run().then( function() {
      assert.deepEqual( actual, expected );
    } );

  } );

} );
