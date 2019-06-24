import Runner from "../../src/core/runner";

describe( "unit", () => {

  it( "failed test", () => {

    let runner = Runner.init();
    let results = runner.listen();
    let test = runner.test;

    test( t => {
      t.plan( 10 );
      t.incCount();
      t.incCount();
    } );

    return runner.run().then( () => {

      expect( results[ 0 ] ).toBe( "runStart" );
      expect( results[ 6 ] ).toBe( "runEnd" );

      expect( results[ 2 ] ).toBe( "testStart" );

      expect( results[ 3 ] ).toEqual( {
        name: "anonymous",
        fullname: [ "anonymous" ],
        suiteName: ""
      } );

      expect( results[ 4 ] ).toBe( "testEnd" );

      expect( typeof results[ 5 ].runtime ).toBe( "number" );

      expect( results[ 5 ].status ).toEqual( "failed" );

      expect( results[ 5 ].errors[ 0 ].message ).toBe( "Planned 10 but 2 assertions were run." );

      expect( results[ 5 ].assertions[ 0 ].message ).toBe( "Planned 10 but 2 assertions were run." );

      expect( results.pop().status ).toBe( "failed" );

    } );

  } );

  it( "passed test", () => {

    let runner = Runner.init();
    let results = runner.listen();
    let test = runner.test;

    test( t => {
      t.plan( 0 );
    } );

    return runner.run().then( () => {

      expect( results[ 0 ] ).toBe( "runStart" );
      expect( results[ 6 ] ).toBe( "runEnd" );

      expect( results[ 2 ] ).toBe( "testStart" );

      expect( results[ 3 ] ).toEqual( {
        name: "anonymous",
        fullname: [ "anonymous" ],
        suiteName: ""
      } );

      expect( results[ 4 ] ).toBe( "testEnd" );

      expect( typeof results[ 5 ].runtime ).toBe( "number" );

      delete results[ 5 ].runtime;

      expect( results[ 5 ] ).toEqual( {
        name: "anonymous",
        fullname: [ "anonymous" ],
        suiteName: "",
        status: "passed",
        errors: [],
        logs: [],
        memoryUsage: 0,
        skipReason: undefined,
        slow: false,
        assertions: []
      } );

      expect( results.pop().status ).toBe( "passed" );

    } );

  } );

  it( "skipped test", () => {

    let runner = Runner.init();
    let results = runner.listen();
    let test = runner.test;

    test( t => {
      t.plan( 10 );
      t.skip( "skip reason" );
    } );

    return runner.run().then( () => {

      expect( results[ 0 ] ).toBe( "runStart" );
      expect( results[ 6 ] ).toBe( "runEnd" );

      expect( results[ 2 ] ).toBe( "testStart" );

      expect( results[ 3 ] ).toEqual( {
        name: "anonymous",
        fullname: [ "anonymous" ],
        suiteName: ""
      } );

      expect( results[ 4 ] ).toBe( "testEnd" );

      expect( typeof results[ 5 ].runtime ).toBe( "number" );

      delete results[ 5 ].runtime;

      expect( results[ 5 ] ).toEqual( {
        name: "anonymous",
        fullname: [ "anonymous" ],
        suiteName: "",
        status: "skipped",
        errors: [],
        logs: [],
        memoryUsage: 0,
        skipReason: "skip reason",
        slow: false,
        assertions: []
      } );

      expect( results.pop().status ).toBe( "skipped" );

    } );

  } );

  it( "failed test has always failed status", () => {

    let runner = Runner.init();
    let results = runner.listen();
    let test = runner.test;

    test( t => {
      return new Promise( ( resolve, reject ) => {
        setTimeout( () => {
          try {
            t.skip( "reason" );
          } catch ( e ) {
            // Ignore
          }
          reject( "message" );
        } );
      } );
    } );

    return runner.run().then( () => {

      expect( results[ 0 ] ).toBe( "runStart" );
      expect( results[ 6 ] ).toBe( "runEnd" );

      expect( results[ 2 ] ).toBe( "testStart" );

      expect( results[ 3 ] ).toEqual( {
        name: "anonymous",
        fullname: [ "anonymous" ],
        suiteName: ""
      } );

      expect( results[ 4 ] ).toBe( "testEnd" );

      expect( typeof results[ 5 ].runtime ).toBe( "number" );

      expect( results[ 5 ].status ).toEqual( "failed" );

      expect( results[ 5 ].skipReason ).toEqual( undefined );

      expect( results[ 5 ].errors[ 0 ].message ).toBe( "message" );

      expect( results[ 5 ].assertions[ 0 ].message ).toBe( "message" );

      expect( results.pop().status ).toBe( "failed" );

    } );

  } );

} );
