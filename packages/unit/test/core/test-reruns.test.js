import Runner from "../../src/core/runner";

describe( "unit", () => {

  it( "test reruns", () => {

    expect.assertions( 2 );

    const runner = Runner.init( { allowNoPlan: true } );
    const results = runner.listen();
    const test = runner.test;

    const actual = [];
    const expected = [
      "test",
      "test"
    ];

    test( "test", t => {
      t.reruns( 1 );
      actual.push( "test" );
    } );

    return runner.run().then( () => {
      expect( actual ).toEqual( expected );
      expect( results.pop().status ).toBe( "passed" );
    } );

  } );

  it( "only rerun if passing", () => {

    expect.assertions( 2 );

    const runner = Runner.init( { allowNoPlan: true } );
    const results = runner.listen();
    const test = runner.test;

    const actual = [];
    const expected = [
      "test"
    ];

    test( "test", t => {
      t.reruns( 100 );
      actual.push( "test" );
      throw new Error( "fail" );
    } );

    return runner.run().then( () => {
      expect( actual ).toEqual( expected );
      expect( results.pop().status ).toBe( "failed" );
    } );

  } );

  it( "test reruns with delay", () => {

    expect.assertions( 3 );

    const runner = Runner.init( { allowNoPlan: true } );
    const results = runner.listen();
    const test = runner.test;

    const times = [];

    test( "test", t => {
      t.reruns( 1 );
      t.rerunDelay( 100 );
      times.push( Date.now() );
    } );

    return runner.run().then( () => {
      expect( times ).toHaveLength( 2 );
      expect( times[ 1 ] - times[ 0 ] >= 100 ).toBe( true );
      expect( results.pop().status ).toBe( "passed" );
    } );

  } );

  it( "test reruns inherit value from group", () => {

    expect.assertions( 2 );

    const runner = Runner.init( { allowNoPlan: true } );
    const results = runner.listen();
    const test = runner.test;

    const actual = [];
    const expected = [
      "test",
      "test"
    ];

    test.group( t => {

      t.reruns( 1 );

      test( "test", () => {
        actual.push( "test" );
      } );

    } );

    return runner.run().then( () => {
      expect( actual ).toEqual( expected );
      expect( results.pop().status ).toBe( "passed" );
    } );

  } );

  it( "hooks are also run when rerunning", () => {

    expect.assertions( 2 );

    const runner = Runner.init( { allowNoPlan: true } );
    const results = runner.listen();
    const test = runner.test;

    const actual = [];
    const expected = [
      "beforeEach",
      "test",
      "afterEach",
      "beforeEach",
      "test",
      "afterEach"
    ];

    test.beforeEach( () => {
      actual.push( "beforeEach" );
    } );

    test.group( t => {

      t.reruns( 1 );

      test( "test", () => {
        actual.push( "test" );
      } );

    } );

    test.afterEach( () => {
      actual.push( "afterEach" );
    } );

    return runner.run().then( () => {
      expect( actual ).toEqual( expected );
      expect( results.pop().status ).toBe( "passed" );
    } );

  } );

  it( "dont rerun if beforeEach failed", () => {

    expect.assertions( 2 );

    const runner = Runner.init( { allowNoPlan: true } );
    const results = runner.listen();
    const test = runner.test;

    const actual = [];
    const expected = [
      "beforeEach",
      "afterEach"
    ];

    test.beforeEach( () => {
      actual.push( "beforeEach" );
      throw new Error( "error" );
    } );

    test.group( t => {

      t.reruns( 1 );

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

  it( "dont rerun if afterEach failed", () => {

    expect.assertions( 2 );

    const runner = Runner.init( { allowNoPlan: true } );
    const results = runner.listen();
    const test = runner.test;

    const actual = [];
    const expected = [
      "beforeEach",
      "test",
      "afterEach"
    ];

    test.beforeEach( () => {
      actual.push( "beforeEach" );
    } );

    test.group( t => {

      t.reruns( 1 );

      test( "test", () => {
        actual.push( "test" );
      } );

    } );

    test.afterEach( () => {
      actual.push( "afterEach" );
      throw new Error( "error" );
    } );

    return runner.run().then( () => {
      expect( actual ).toEqual( expected );
      expect( results.pop().status ).toBe( "failed" );
    } );

  } );

  it( "calling .reruns() again makes no difference", () => {

    expect.assertions( 2 );

    const runner = Runner.init( { allowNoPlan: true } );
    const results = runner.listen();
    const test = runner.test;

    const actual = [];
    const expected = [
      "test",
      "test rerun"
    ];

    let count = 0;

    test( "test", t => {
      t.reruns( 1 );
      if ( count++ === 0 ) {
        actual.push( "test" );
      } else {
        t.reruns( 10 );
        actual.push( "test rerun" );
      }
    } );

    return runner.run().then( () => {
      expect( actual ).toEqual( expected );
      expect( results.pop().status ).toBe( "passed" );
    } );

  } );

  it( "mark as skipped if called t.skip() in second run", () => {

    expect.assertions( 2 );

    const runner = Runner.init( { allowNoPlan: true } );
    const results = runner.listen();
    const test = runner.test;

    const actual = [];
    const expected = [
      "beforeEach",
      "test",
      "afterEach",
      "beforeEach",
      "test",
      "afterEach"
    ];

    let count = 0;

    test.beforeEach( () => {
      actual.push( "beforeEach" );
    } );

    test.group( t => {

      t.reruns( 1 );

      test( "test", t => {
        actual.push( "test" );
        if ( count++ === 0 ) {
          // Continue
        } else {
          t.skip();
        }
      } );

    } );

    test.afterEach( () => {
      actual.push( "afterEach" );
    } );

    return runner.run().then( () => {
      expect( actual ).toEqual( expected );
      expect( results.pop().status ).toBe( "skipped" );
    } );

  } );

  it( "mark as skipped if called t.skip() (inside beforeEach) in second run", () => {

    expect.assertions( 2 );

    const runner = Runner.init( { allowNoPlan: true } );
    const results = runner.listen();
    const test = runner.test;

    const actual = [];
    const expected = [
      "beforeEach",
      "test",
      "afterEach",
      "beforeEach",
      "afterEach"
    ];

    let count = 0;

    test.beforeEach( t => {
      actual.push( "beforeEach" );
      if ( count !== 0 ) {
        t.skip();
      }
    } );

    test.group( t => {

      t.reruns( 1 );

      test( "test", () => {
        actual.push( "test" );
        count++;
      } );

    } );

    test.afterEach( () => {
      actual.push( "afterEach" );
    } );

    return runner.run().then( () => {
      expect( actual ).toEqual( expected );
      expect( results.pop().status ).toBe( "skipped" );
    } );

  } );

  it( ".reruns() not available for hooks", () => {

    expect.assertions( 2 );

    const runner = Runner.init( { allowNoPlan: true } );
    const results = runner.listen();
    const test = runner.test;

    const actual = [];
    const expected = [];

    test.beforeEach( t => {
      t.reruns( 10 );
    } );

    test( () => {
      /* istanbul ignore next */
      actual.push( "dont run" );
    } );

    return runner.run().then( () => {
      expect( actual ).toEqual( expected );
      expect( results[ 5 ].errors[ 0 ].message ).toBe( ".reruns() is not available for hooks" );
    } );

  } );

  it( ".rerunDelay() not available for hooks", () => {

    expect.assertions( 2 );

    const runner = Runner.init( { allowNoPlan: true } );
    const results = runner.listen();
    const test = runner.test;

    const actual = [];
    const expected = [];

    test.beforeEach( t => {
      t.rerunDelay( 10 );
    } );

    test( () => {
      /* istanbul ignore next */
      actual.push( "dont run" );
    } );

    return runner.run().then( () => {
      expect( actual ).toEqual( expected );
      expect( results[ 5 ].errors[ 0 ].message ).toBe( ".rerunDelay() is not available for hooks" );
    } );

  } );

  it( "throw when rerunDelay value is not number - group", () => {

    const runner = Runner.init( { allowNoPlan: true } );
    const test = runner.test;

    expect( () => {
      test.group( t => {
        t.rerunDelay( "abc" );
      } );
    } ).toThrow( /Expected a number but saw/ );

  } );

  it( "throw when rerunDelay value is too big - group", () => {

    const runner = Runner.init( { allowNoPlan: true } );
    const test = runner.test;

    expect( () => {
      test.group( t => {
        t.rerunDelay( 2 ** 31 + 1 );
      } );
    } ).toThrow( /2147483649 is too big of a delay value/ );

  } );

  it( "test retries + reruns passing", () => {

    expect.assertions( 2 );

    const runner = Runner.init( { allowNoPlan: true } );
    const results = runner.listen();
    const test = runner.test;

    const output = [
      false,
      false,
      true,
      false,
      false,
      true
    ];

    const actual = [];
    const expected = [
      "fail",
      "fail",
      "ok",
      "fail",
      "fail",
      "ok"
    ];

    let i = 0;

    test( "test", t => {
      t.reruns( 1 );
      t.retries( 2 );

      if ( output[ i++ ] ) {
        actual.push( "ok" );
      } else {
        actual.push( "fail" );
        throw new Error( "fail" );
      }
    } );

    return runner.run().then( () => {
      expect( actual ).toEqual( expected );
      expect( results.pop().status ).toBe( "passed" );
    } );

  } );

  it( "test retries + reruns failing", () => {

    expect.assertions( 2 );

    const runner = Runner.init( { allowNoPlan: true } );
    const results = runner.listen();
    const test = runner.test;

    const output = [
      false,
      false,
      false,
      false,
      false,
      false
    ];

    const actual = [];
    const expected = [
      "fail",
      "fail",
      "fail"
    ];

    let i = 0;

    test( "test", t => {
      t.reruns( 1 );
      t.retries( 2 );

      if ( output[ i++ ] ) {
        actual.push( "ok" );
      } else {
        actual.push( "fail" );
        throw new Error( "fail" );
      }
    } );

    return runner.run().then( () => {
      expect( actual ).toEqual( expected );
      expect( results.pop().status ).toBe( "failed" );
    } );

  } );

} );
