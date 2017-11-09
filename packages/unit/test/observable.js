import { Runner } from "../src";
import assert from "../../assert";

describe( "unit", () => {

  it( "supports observables", () => {

    if ( typeof require === "undefined" ) {
      assert.expect( 0 );
      return;
    }

    assert.expect( 1 );

    let Observable = require( "zen-observable" );

    let runner = Runner.init();
    let results = runner.listen();
    let t = runner.test;

    t( "test", () => {
      return new Observable( observer => {
        observer.complete();
      } );
    } );

    t.failing( () => {
      return new Observable( observer => {
        observer.error( "error!" );
      } );
    } );

    return runner.run().then( () => {
      assert.deepEqual( results.pop().status, "passed" );
    } );

  } );

} );
