import { Runner } from "../../src";
import assert from "../../../assert";

describe( "unit", () => {

  it( "delayed setup", () => {

    assert.expect( 2 );

    const runner = Runner.init( { allowNoPlan: true } );
    const results = runner.listen();
    const test = runner.test;

    const actual = [];
    const expected = [
      "test 1",
      "test 2",
      "test 3"
    ];

    const group = test.group( g => {

      g.delaySetup( Promise.resolve().then( () => {
        g.test( () => {
          actual.push( "test 1" );
        } );
      } ) );

      return Promise.resolve().then( () => {
        g.test( () => {
          actual.push( "test 2" );
        } );
      } );

    } );

    group.delaySetup( Promise.resolve().then( () => {
      group.test( () => {
        actual.push( "test 3" );
      } );
    } ) );

    return runner.run().then( () => {
      assert.deepEqual( actual, expected );
      assert.deepEqual( results[ results.length - 1 ].testCounts, {
        passed: 3,
        skipped: 0,
        failed: 0,
        todo: 0,
        total: 3
      } );
    } );

  } );

} );
