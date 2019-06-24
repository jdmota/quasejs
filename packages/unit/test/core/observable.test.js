import Runner from "../../src/core/runner";

describe( "unit", () => {

  it( "supports observables", () => {

    if ( typeof require === "undefined" ) {
      expect.assertions( 0 );
      return;
    }

    expect.assertions( 1 );

    let Observable = require( "zen-observable" );

    let runner = Runner.init( { allowNoPlan: true } );
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
      expect( results.pop().status ).toEqual( "passed" );
    } );

  } );

} );
