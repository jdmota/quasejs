import Runner from "../../src/core/runner";

describe( "unit", () => {

  it( "fast bail is off by default", () => {

    expect.assertions( 2 );

    let runner = Runner.init( { allowNoPlan: true } );
    let results = runner.listen();
    let test = runner.test;

    let actual = [];
    let expected = [
      "test",
      "bail",
      "test2"
    ];

    test( () => {
      actual.push( "test" );
    } );

    test( () => {
      actual.push( "bail" );
      throw new Error( "Error" );
    } );

    test( () => {
      actual.push( "test2" );
    } );

    return runner.run().then( () => {
      expect( actual ).toEqual( expected );
      expect( results.pop().status ).toBe( "failed" );
    } );

  } );

  it( "fast bail", () => {

    expect.assertions( 2 );

    let runner = Runner.init( {
      bail: true,
      allowNoPlan: true
    } );
    let results = runner.listen();
    let test = runner.test;

    let actual = [];
    let expected = [
      "before",
      "test",
      "bail",
      "after"
    ];

    test.before( () => {
      actual.push( "before" );
    } );

    test( () => {
      actual.push( "test" );
    } );

    test( () => {
      actual.push( "bail" );
      throw new Error( "Error" );
    } );

    test.group( () => {
      test.before( () => {
        /* istanbul ignore next */
        actual.push( "dont run" );
      } );
      test( () => {
        /* istanbul ignore next */
        actual.push( "dont run" );
      } );
    } );

    test.group( () => {
      test.before( () => {
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

    test.after( () => {
      actual.push( "after" );
    } );

    return runner.run().then( () => {
      expect( actual ).toEqual( expected );
      expect( results.pop().status ).toBe( "failed" );
    } );

  } );

  it( "fast bail - error in before", () => {

    expect.assertions( 2 );

    let runner = Runner.init( {
      bail: true,
      allowNoPlan: true
    } );
    let results = runner.listen();
    let test = runner.test;

    let actual = [];
    let expected = [
      "before",
      "before 2",
      "after"
    ];

    test.before( () => {
      actual.push( "before" );
      throw new Error( "Error" );
    } );

    test.before( () => {
      actual.push( "before 2" );
    } );

    test( () => {
      /* istanbul ignore next */
      actual.push( "dont run" );
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
      test( () => {
        /* istanbul ignore next */
        actual.push( "dont run" );
      } );
    } );

    test.group( () => {
      test.before( () => {
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

    test.after( () => {
      actual.push( "after" );
    } );

    return runner.run().then( () => {
      expect( actual ).toEqual( expected );
      expect( results.pop().status ).toBe( "failed" );
    } );

  } );

  it( "fast bail - error in beforeEach", () => {

    expect.assertions( 2 );

    let runner = Runner.init( {
      bail: true,
      allowNoPlan: true
    } );
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

  it( "fast bail in group with async code", () => {

    expect.assertions( 2 );

    function timeout() {
      return new Promise( resolve => {
        setTimeout( resolve, 5 );
      } );
    }

    let runner = Runner.init( { allowNoPlan: true, bail: true } );
    let results = runner.listen();
    let test = runner.test;

    let actual = [];
    let expected = [
      "test 1",
      "test 2"
    ];

    test.group( () => {

      test.serial( () => {
        actual.push( "test 1" );
        return timeout();
      } );

      test.serial( () => {
        actual.push( "test 2" );
        return timeout().then( () => {
          throw new Error( "Error" );
        } );
      } );

      test.serial( () => {
        /* istanbul ignore next */
        actual.push( "dont run" );
      } );

    } );

    return runner.run().then( () => {
      expect( actual ).toEqual( expected );
      expect( results.pop().status ).toBe( "failed" );
    } );

  } );

  it( "error in serial sequence stops concurrent sequence", () => {

    expect.assertions( 2 );

    let runner = Runner.init( { allowNoPlan: true, bail: true } );
    let results = runner.listen();
    let test = runner.test;

    let actual = [];
    let expected = [
      "beforeEach",
      "serial",
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
        /* istanbul ignore next */
        actual.push( "dont run" );
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

  it( "skipped test remains skipped", () => {

    expect.assertions( 3 );

    const runner = Runner.init( {
      bail: true,
      allowNoPlan: true
    } );
    const results = runner.listen();
    const test = runner.test;

    const actual = [];
    const expected = [
      "bail"
    ];

    test( () => {
      actual.push( "bail" );
      throw new Error( "Error" );
    } );

    test.skip( () => {
      /* istanbul ignore next */
      actual.push( "dont run 1" );
    } );

    test( () => {
      /* istanbul ignore next */
      actual.push( "dont run 2" );
    } );

    return runner.run().then( () => {
      expect( actual ).toEqual( expected );
      expect( results[ results.length - 1 ].status ).toBe( "failed" );
      expect( results[ results.length - 1 ].testCounts ).toEqual( {
        failed: 1,
        skipped: 2,
        passed: 0,
        todo: 0,
        total: 3
      } );
    } );

  } );

  it( "skipped group remains skipped", () => {

    expect.assertions( 3 );

    const runner = Runner.init( {
      bail: true,
      allowNoPlan: true
    } );
    const results = runner.listen();
    const test = runner.test;

    const actual = [];
    const expected = [
      "bail"
    ];

    test( () => {
      actual.push( "bail" );
      throw new Error( "Error" );
    } );

    test.group.skip( () => {
      test( () => {
        /* istanbul ignore next */
        actual.push( "dont run 1" );
      } );

      test( () => {
        /* istanbul ignore next */
        actual.push( "dont run 2" );
      } );
    } );

    return runner.run().then( () => {
      expect( actual ).toEqual( expected );
      expect( results[ results.length - 1 ].status ).toBe( "failed" );
      expect( results[ results.length - 1 ].testCounts ).toEqual( {
        failed: 1,
        skipped: 2,
        passed: 0,
        todo: 0,
        total: 3
      } );
    } );

  } );

} );
