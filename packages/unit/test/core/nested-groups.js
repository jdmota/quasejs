import Runner from "../../src/core/runner";

describe( "unit", () => {

  it( "nested groups", () => {

    expect.assertions( 2 );

    let runner = Runner.init( { allowNoPlan: true } );
    let results = runner.listen();
    let test = runner.test;

    let actual = [];
    let expected = [
      "test 1",
      "test 2",
      "test 3",
      "test 4",
      "test 5"
    ];

    test.group( "group 1", () => {

      test( () => {
        actual.push( "test 1" );
      } );

      test.group( "group 2", () => {

        test( () => {
          actual.push( "test 2" );
        } );

        test( () => {
          actual.push( "test 3" );
        } );

        test.group( "group 3", () => {

          test( function( t ) {
            actual.push( "test 4" );
            t.skip();
          } );

          test( () => {
            actual.push( "test 5" );
            throw new Error( "Error" );
          } );

        } );

      } );

    } );

    return runner.run().then( () => {
      expect( actual ).toEqual( expected );
      expect( results[ results.length - 1 ].testCounts ).toEqual( {
        passed: 3,
        skipped: 1,
        failed: 1,
        todo: 0,
        total: 5
      } );
    } );

  } );

  it( "nested groups with alternative api", () => {

    expect.assertions( 10 );

    let runner = Runner.init( { allowNoPlan: true } );
    let results = runner.listen();
    let test = runner.test;

    let actual = [];
    let expected = [
      "test 1",
      "test 2",
      "test 3",
      "test 4",
      "test 5"
    ];

    test.group( "group 1", function( group ) {

      group.test( () => {
        actual.push( "test 1" );
      } );

      const group2 = test.group( "group 2" );

      expect( "timeout" in group2 ).toBe( true );
      expect( "retries" in group2 ).toBe( true );
      expect( "slow" in group2 ).toBe( true );

      group2.test( () => {
        actual.push( "test 2" );
      } );

      group2.test( () => {
        actual.push( "test 3" );
      } );

      group2.group( () => {

        test( function( t ) {
          actual.push( "test 4" );
          t.skip();
        } );

        test( () => {
          actual.push( "test 5" );
          throw new Error( "Error" );
        } );

      } );

    } );

    return runner.run().then( () => {
      expect( actual ).toEqual( expected );
      expect( results[ 3 ].tests.length ).toEqual( 1 );
      expect( results[ 3 ].childSuites.length ).toBe( 1 );
      expect( results[ 3 ].testCounts.total ).toBe( 5 );

      delete results[ 21 ].defaultStack;
      delete results[ 25 ].defaultStack;

      expect( results[ 21 ] ).toEqual( {
        fullname: [ "group 1", "group 2", "anonymous", "anonymous" ],
        name: "anonymous",
        suiteName: "anonymous"
      } );
      expect( results[ 25 ] ).toEqual( {
        fullname: [ "group 1", "group 2", "anonymous", "anonymous" ],
        name: "anonymous",
        suiteName: "anonymous"
      } );
      expect( results[ results.length - 1 ].testCounts ).toEqual( {
        passed: 3,
        skipped: 1,
        failed: 1,
        todo: 0,
        total: 5
      } );
    } );

  } );

} );
