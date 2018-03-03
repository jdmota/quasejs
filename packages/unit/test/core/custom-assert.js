import Runner from "../../src/core/runner";

describe( "unit", () => {

  it( "custom assert", () => {

    let runner = Runner.init( {
      assertions: [
        {
          fail() {
            const e = new Error( "custom failed assertion" );
            e.expected = "abcadsadedascasdac";
            e.actual = "bcedabhdytewvdhagvda";
            throw e;
          }
        }
      ]
    } );

    let results = runner.listen();
    let test = runner.test;

    test( t => {
      t.fail();
    } );

    return runner.run().then( () => {
      expect( results[ 5 ].status ).toEqual( "failed" );
      expect( results[ 5 ].errors[ 0 ].message ).toBe( "custom failed assertion" );
      expect( results.pop().status ).toBe( "failed" );
    } );

  } );

} );
