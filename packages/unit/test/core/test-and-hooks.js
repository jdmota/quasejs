import Runner from "../../src/core/runner";

describe( "unit", () => {

  it( "error in before hook", () => {

    expect.assertions( 4 );

    let runner = Runner.init( { allowNoPlan: true } );
    let results = runner.listen();
    let t = runner.test;

    let actual = [];
    let expected = [
      "before",
      "after"
    ];

    t.before( () => {
      actual.push( "before" );
      throw new Error( "Error in hook." );
    } );

    t.test( () => {
      /* istanbul ignore next */
      actual.push( "don't run" );
    } );

    t.test( () => {
      /* istanbul ignore next */
      actual.push( "don't run" );
    } );

    t.group( () => {
      t( () => {
        /* istanbul ignore next */
        actual.push( "don't run" );
      } );
    } );

    t.after( () => {
      actual.push( "after" );
    } );

    return runner.run().then( () => {
      expect( actual ).toEqual( expected );
      expect( results[ 19 ].skipReason ).toBe( "Failed because of an error in a previous hook." );
      expect( results[ results.length - 1 ].testCounts ).toEqual( {
        passed: 1,
        skipped: 3,
        failed: 1,
        todo: 0,
        total: 5
      } );
      expect( results.pop().status ).toBe( "failed" );
    } );

  } );

  it( ".skip() in before hook", () => {

    expect.assertions( 7 );

    let runner = Runner.init( { allowNoPlan: true } );
    let results = runner.listen();
    let t = runner.test;

    let actual = [];
    let expected = [
      "before 1",
      "before 2",
      "after"
    ];

    t.before( function( t ) {
      actual.push( "before 1" );
      t.skip( "reason 1" );
    } );

    t.before( function( t ) {
      actual.push( "before 2" );
      t.skip( "reason 2" );
    } );

    t.test( "test1", () => {
      /* istanbul ignore next */
      actual.push( "don't run" );
    } );

    t.test( () => {
      /* istanbul ignore next */
      actual.push( "don't run" );
    } );

    t.group( () => {
      t( () => {
        /* istanbul ignore next */
        actual.push( "don't run" );
      } );
    } );

    t.after( () => {
      actual.push( "after" );
    } );

    return runner.run().then( () => {
      expect( actual ).toEqual( expected );
      expect( results[ 13 ].name ).toBe( "test1" );
      expect( results[ 13 ].status ).toBe( "skipped" );
      expect( results[ 13 ].skipReason ).toBe( "reason 1" );
      expect( results[ 13 ].runtime ).toBe( 0 );
      expect( results[ results.length - 1 ].testCounts ).toEqual( {
        passed: 1,
        skipped: 5,
        failed: 0,
        todo: 0,
        total: 6
      } );
      expect( results.pop().status ).toBe( "passed" );
    } );

  } );

  it( "error in beforeEach hook", () => {

    expect.assertions( 2 );

    let runner = Runner.init( { allowNoPlan: true } );
    let results = runner.listen();
    let t = runner.test;

    let actual = [];
    let expected = [
      "group",
      "beforeEach",
      "afterEach"
    ];

    t.beforeEach( () => {
      actual.push( "beforeEach" );
      throw new Error( "Error" );
    } );

    t.test( () => {
      /* istanbul ignore next */
      actual.push( "don't run" );
    } );

    t.test( () => {
      /* istanbul ignore next */
      actual.push( "don't run" );
    } );

    t.group( () => {
      actual.push( "group" );
      t.test( () => {
        /* istanbul ignore next */
        actual.push( "don't run" );
      } );
    } );

    t.afterEach( () => {
      actual.push( "afterEach" );
    } );

    return runner.run().then( () => {
      expect( actual ).toEqual( expected );
      expect( results.pop().status ).toBe( "failed" );
    } );

  } );

  it( ".skip() in beforeEach hook", () => {

    expect.assertions( 3 );

    let runner = Runner.init( { allowNoPlan: true } );
    let results = runner.listen();
    let t = runner.test;

    let actual = [];
    let expected = [
      "group",
      "beforeEach",
      "afterEach",
      "beforeEach",
      "afterEach"
    ];

    t.beforeEach( function( t ) {
      actual.push( "beforeEach" );
      t.skip();
    } );

    t.test( () => {
      /* istanbul ignore next */
      actual.push( "don't run" );
    } );

    t.test( () => {
      /* istanbul ignore next */
      actual.push( "don't run" );
    } );

    t.group( () => {
      actual.push( "group" );
    } );

    t.afterEach( () => {
      actual.push( "afterEach" );
    } );

    return runner.run().then( () => {
      expect( actual ).toEqual( expected );
      expect( results.length ).toBe( 16 );
      expect( results.pop().status ).toBe( "skipped" );
    } );

  } );

  it( "skip + error in beforeEach hooks", () => {

    expect.assertions( 5 );

    let runner = Runner.init( { allowNoPlan: true } );
    let results = runner.listen();
    let t = runner.test;

    let actual = [];
    let expected = [
      "beforeEach 1",
      "beforeEach 2",
      "afterEach"
    ];

    t.beforeEach( function( t ) {
      actual.push( "beforeEach 1" );
      t.skip();
    } );

    t.beforeEach( () => {
      actual.push( "beforeEach 2" );
      throw new Error( "Error" );
    } );

    t.test( () => {
      /* istanbul ignore next */
      actual.push( "don't run" );
    } );

    t.afterEach( () => {
      actual.push( "afterEach" );
    } );

    return runner.run().then( () => {
      expect( actual ).toEqual( expected );
      expect( results.length ).toBe( 8 );
      expect( results[ 5 ].skipReason ).toBe( undefined );
      expect( results[ 5 ].status ).toBe( "failed" );
      expect( results.pop().status ).toBe( "failed" );
    } );

  } );

  it( "error in beforeEach causes other tests to be skipped", () => {

    expect.assertions( 2 );

    let runner = Runner.init( { allowNoPlan: true } );
    let results = runner.listen();
    let test = runner.test;

    let actual = [];
    let expected = [
      "beforeEach",
      "beforeEach 2",
      "afterEach"
    ];

    test.beforeEach( () => {
      actual.push( "beforeEach" );
      throw new Error( "Error" );
    } );

    test.beforeEach( () => {
      actual.push( "beforeEach 2" );
    } );

    test( () => {
      /* istanbul ignore next */
      actual.push( "dont run" );
    } );

    test.group( () => {
      test.before( () => {
        /* istanbul ignore next */
        actual.push( "dont run" );
      } );
      test.beforeEach( () => {
        /* istanbul ignore next */
        actual.push( "dont run" );
      } );
      test( () => {
        /* istanbul ignore next */
        actual.push( "dont run" );
      } );
    } );

    test( () => {
      /* istanbul ignore next */
      actual.push( "dont run" );
    } );

    test.afterEach( () => {
      actual.push( "afterEach" );
    } );

    return runner.run().then( () => {
      expect( actual ).toEqual( expected );
      expect( results.pop().status ).toBe( "failed" );
    } );

  } );

  it( "error in beforeEach does not skip tests in outer suites", () => {

    expect.assertions( 2 );

    let runner = Runner.init( { allowNoPlan: true } );
    let results = runner.listen();
    let test = runner.test;

    let actual = [];
    let expected = [
      "beforeEach",
      "beforeEach 2",
      "afterEach 2",
      "afterEach",
      "beforeEach",
      "beforeEach 3",
      "inner test",
      "afterEach",
      "beforeEach",
      "test",
      "afterEach"
    ];

    test.beforeEach( "beforeEach", () => {
      actual.push( "beforeEach" );
    } );

    test.group( "group 1", () => {
      test.beforeEach( "beforeEach 2", () => {
        actual.push( "beforeEach 2" );
        throw new Error( "Error" );
      } );
      test.serial( () => {
        /* istanbul ignore next */
        actual.push( "dont run" );
      } );
      test( () => {
        /* istanbul ignore next */
        actual.push( "dont run" );
      } );
      test( () => {
        /* istanbul ignore next */
        actual.push( "dont run" );
      } );
      test.afterEach( () => {
        actual.push( "afterEach 2" );
      } );
    } );

    test.group( "group 2", () => {
      test.beforeEach( "beforeEach 3", () => {
        actual.push( "beforeEach 3" );
      } );
      test( () => {
        actual.push( "inner test" );
      } );
    } );

    test( "test", () => {
      actual.push( "test" );
    } );

    test.afterEach( "afterEach", () => {
      actual.push( "afterEach" );
    } );

    return runner.run().then( () => {
      expect( actual ).toEqual( expected );
      expect( results.pop().status ).toBe( "failed" );
    } );

  } );

  it( "error in beforeEach skips tests in the suite it was defined and in subsuites", () => {

    expect.assertions( 2 );

    let runner = Runner.init( { allowNoPlan: true } );
    let results = runner.listen();
    let test = runner.test;

    let actual = [];
    let expected = [
      "beforeEach",
      "afterEach"
    ];

    test.beforeEach( () => {
      actual.push( "beforeEach" );
      throw new Error( "Error" );
    } );

    test.group( () => {
      test.serial( () => {
        /* istanbul ignore next */
        actual.push( "dont run" );
      } );
      test( () => {
        /* istanbul ignore next */
        actual.push( "dont run" );
      } );
      test( () => {
        /* istanbul ignore next */
        actual.push( "dont run" );
      } );
    } );

    test( () => {
      /* istanbul ignore next */
      actual.push( "dont run" );
    } );

    test.afterEach( () => {
      actual.push( "afterEach" );
    } );

    return runner.run().then( () => {
      expect( actual ).toEqual( expected );
      expect( results.pop().status ).toBe( "failed" );
    } );

  } );

  it( "error in beforeEach skips tests in the suite it was defined and in subsuites even if succeded before", () => {

    expect.assertions( 2 );

    let runner = Runner.init( { allowNoPlan: true } );
    let results = runner.listen();
    let test = runner.test;
    let count = 0;

    let actual = [];
    let expected = [
      "beforeEach",
      "beforeEach 2",
      "afterEach",
      "beforeEach",
      "test 1",
      "afterEach",
      "beforeEach",
      "afterEach"
    ];

    test.beforeEach( () => {
      actual.push( "beforeEach" );
      if ( count > 1 ) {
        throw new Error( "Error" );
      }
      count++;
    } );

    test.group( () => {
      test.beforeEach( () => {
        actual.push( "beforeEach 2" );
        throw new Error( "Error" );
      } );
      test( () => {
        /* istanbul ignore next */
        actual.push( "dont run" );
      } );
    } );

    test( () => {
      actual.push( "test 1" );
    } );

    test.group( () => {
      test( () => {
        /* istanbul ignore next */
        actual.push( "dont run" );
      } );
    } );

    test( () => {
      /* istanbul ignore next */
      actual.push( "dont run" );
    } );

    test.afterEach( () => {
      actual.push( "afterEach" );
    } );

    return runner.run().then( () => {
      expect( actual ).toEqual( expected );
      expect( results.pop().status ).toBe( "failed" );
    } );

  } );

  it( "error in afterEach causes other tests to be skipped", () => {

    expect.assertions( 2 );

    let runner = Runner.init( { allowNoPlan: true } );
    let results = runner.listen();
    let test = runner.test;

    let actual = [];
    let expected = [
      "beforeEach",
      "beforeEach 2",
      "inner test",
      "afterEach 2",
      "afterEach",
      "beforeEach",
      "outer test",
      "afterEach"
    ];

    test.beforeEach( () => {
      actual.push( "beforeEach" );
    } );

    test.group( () => {
      test.beforeEach( () => {
        actual.push( "beforeEach 2" );
      } );
      test( () => {
        actual.push( "inner test" );
      } );
      test.afterEach( () => {
        actual.push( "afterEach 2" );
        throw new Error( "Error" );
      } );
      test( () => {
        /* istanbul ignore next */
        actual.push( "dont run" );
      } );
    } );

    test( () => {
      actual.push( "outer test" );
    } );

    test.afterEach( () => {
      actual.push( "afterEach" );
    } );

    return runner.run().then( () => {
      expect( actual ).toEqual( expected );
      expect( results.pop().status ).toBe( "failed" );
    } );

  } );

  it( "error in afterEach skips tests in the suite it was defined and in subsuites", () => {

    expect.assertions( 2 );

    let runner = Runner.init( { allowNoPlan: true } );
    let results = runner.listen();
    let test = runner.test;

    let actual = [];
    let expected = [
      "beforeEach",
      "test",
      "afterEach"
    ];

    test.beforeEach( () => {
      actual.push( "beforeEach" );
    } );

    test.group( () => {
      test.serial( () => {
        actual.push( "test" );
      } );
      test( () => {
        /* istanbul ignore next */
        actual.push( "dont run" );
      } );
      test( () => {
        /* istanbul ignore next */
        actual.push( "dont run" );
      } );
    } );

    test( () => {
      /* istanbul ignore next */
      actual.push( "dont run" );
    } );

    test.afterEach( () => {
      actual.push( "afterEach" );
      throw new Error( "Error" );
    } );

    return runner.run().then( () => {
      expect( actual ).toEqual( expected );
      expect( results.pop().status ).toBe( "failed" );
    } );

  } );

  it( "error in afterEach skips tests in the suite it was defined and in subsuites even if succeded before", () => {

    expect.assertions( 2 );

    let runner = Runner.init( { allowNoPlan: true } );
    let results = runner.listen();
    let test = runner.test;
    let count = 0;

    let actual = [];
    let expected = [
      "beforeEach",
      "test",
      "afterEach",
      "beforeEach",
      "test 2",
      "afterEach",
      "after"
    ];

    test.beforeEach( () => {
      actual.push( "beforeEach" );
    } );

    test.group( () => {
      test.serial( () => {
        actual.push( "test" );
      } );
      test( () => {
        actual.push( "test 2" );
      } );
    } );

    test( () => {
      /* istanbul ignore next */
      actual.push( "dont run" );
    } );

    test.afterEach( () => {
      actual.push( "afterEach" );
      if ( count > 0 ) {
        throw new Error( "Error" );
      }
      count++;
    } );

    test.after( () => {
      actual.push( "after" );
    } );

    return runner.run().then( () => {
      expect( actual ).toEqual( expected );
      expect( results.pop().status ).toBe( "failed" );
    } );

  } );

  it( "skip in after hook", () => {

    expect.assertions( 4 );

    let runner = Runner.init( { allowNoPlan: true } );
    let results = runner.listen();
    let t = runner.test;

    let actual = [];
    let expected = [
      "before",
      "test",
      "after"
    ];

    t.before( () => {
      actual.push( "before" );
    } );

    t.test( () => {
      actual.push( "test" );
    } );

    t.after( function( t ) {
      actual.push( "after" );
      t.skip();
    } );

    return runner.run().then( () => {
      expect( actual ).toEqual( expected );
      expect( results.length ).toBe( 16 );
      expect( results[ 13 ].status ).toBe( "skipped" );
      expect( results.pop().status ).toBe( "passed" );
    } );

  } );

  it( "skip in afterEach hook", () => {

    expect.assertions( 3 );

    let runner = Runner.init( { allowNoPlan: true } );
    let results = runner.listen();
    let t = runner.test;

    let actual = [];
    let expected = [
      "beforeEach",
      "test",
      "afterEach"
    ];

    t.beforeEach( () => {
      actual.push( "beforeEach" );
    } );

    t.test( () => {
      actual.push( "test" );
    } );

    t.afterEach( function( t ) {
      actual.push( "afterEach" );
      t.skip();
    } );

    return runner.run().then( () => {
      expect( actual ).toEqual( expected );
      expect( results.length ).toBe( 8 );
      expect( results.pop().status ).toBe( "passed" );
    } );

  } );

  it( "error in serial sequence does not affect concurrent sequence", () => {

    expect.assertions( 2 );

    let runner = Runner.init( { allowNoPlan: true } );
    let results = runner.listen();
    let test = runner.test;

    let actual = [];
    let expected = [
      "beforeEach",
      "serial",
      "afterEach",
      "beforeEach",
      "concurrent",
      "afterEach"
    ];

    test.beforeEach( () => {
      actual.push( "beforeEach" );
    } );

    test.group( () => {
      test.serial( () => {
        actual.push( "serial" );
        throw new Error( "error" );
      } );
      test( () => {
        actual.push( "concurrent" );
      } );
    } );

    test.afterEach( () => {
      actual.push( "afterEach" );
    } );

    return runner.run().then( () => {
      expect( actual ).toEqual( expected );
      expect( results.pop().status ).toBe( "failed" );
    } );

  } );

} );
