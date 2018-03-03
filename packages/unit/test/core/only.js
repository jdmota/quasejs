import Runner from "../../src/core/runner";

describe( "unit", () => {

  it( "only", () => {

    expect.assertions( 3 );

    let runner = Runner.init( { allowNoPlan: true } );
    let results = runner.listen();
    let t = runner.test;

    let actual = [];
    let expected = [
      "group",
      "before",
      "beforeEach",
      "group beforeEach",
      "group beforeEach 2",
      "group test",
      "group afterEach",
      "group afterEach 2",
      "afterEach",
      "afterEach 2",
      "after",
      "after 2"
    ];

    t.before( () => {
      actual.push( "before" );
    } );

    t.after( () => {
      actual.push( "after" );
    } );

    t.after( () => {
      actual.push( "after 2" );
    } );

    t.beforeEach( () => {
      actual.push( "beforeEach" );
    } );

    t.serial( () => {
      /* istanbul ignore next */
      actual.push( "dont run" );
    } );

    t( () => {
      /* istanbul ignore next */
      actual.push( "dont run" );
    } );

    t.group.only( () => {

      actual.push( "group" );

      t.beforeEach( () => {
        actual.push( "group beforeEach" );
      } );

      t.afterEach( () => {
        actual.push( "group afterEach" );
      } );

      t.beforeEach( () => {
        actual.push( "group beforeEach 2" );
      } );

      t.afterEach( () => {
        actual.push( "group afterEach 2" );
      } );

      t.only( () => {
        actual.push( "group test" );
      } );

      t.failing.serial( () => {
        /* istanbul ignore next */
        actual.push( "dont run" );
      } );

      t.skip( () => {
        /* istanbul ignore next */
        actual.push( "dont run" );
      } );

    } );

    t.afterEach( () => {
      actual.push( "afterEach" );
    } );

    t.afterEach( () => {
      actual.push( "afterEach 2" );
    } );

    return runner.run().then( () => {
      expect( actual ).toEqual( expected );
      expect( results[ results.length - 1 ].onlyCount ).toBe( 2 );
      expect( results[ results.length - 1 ].testCounts ).toEqual( {
        failed: 0,
        passed: 4,
        skipped: 0,
        todo: 0,
        total: 4
      } );
    } );

  } );

  it( "only - ignore group", () => {

    expect.assertions( 3 );

    let runner = Runner.init( { allowNoPlan: true } );
    let results = runner.listen();
    let t = runner.test;

    let actual = [];
    let expected = [
      "only"
    ];

    t.only( () => {
      actual.push( "only" );
    } );

    t.group( () => {

      t( () => {
        /* istanbul ignore next */
        actual.push( "dont run" );
      } );

    } );

    return runner.run().then( () => {
      expect( actual ).toEqual( expected );
      expect( results[ results.length - 1 ].onlyCount ).toBe( 1 );
      expect( results[ results.length - 1 ].testCounts ).toEqual( {
        failed: 0,
        passed: 1,
        skipped: 0,
        todo: 0,
        total: 1
      } );
    } );

  } );

  it( "only & --only", () => {

    expect.assertions( 3 );

    const runner = Runner.init( { allowNoPlan: true, only: true } );
    const results = runner.listen();
    const t = runner.test;

    const actual = [];
    const expected = [
      "group test"
    ];

    t.serial( () => {
      /* istanbul ignore next */
      actual.push( "dont run" );
    } );

    t( () => {
      /* istanbul ignore next */
      actual.push( "dont run" );
    } );

    t.group( () => {

      t.only( () => {
        actual.push( "group test" );
      } );

      t.failing.serial( () => {
        /* istanbul ignore next */
        actual.push( "dont run" );
      } );

      t.skip( () => {
        /* istanbul ignore next */
        actual.push( "dont run" );
      } );

    } );

    return runner.run().then( () => {
      expect( actual ).toEqual( expected );
      expect( results[ results.length - 1 ].onlyCount ).toBe( 1 );
      expect( results[ results.length - 1 ].testCounts ).toEqual( {
        failed: 0,
        passed: 1,
        skipped: 0,
        todo: 0,
        total: 1
      } );
    } );

  } );

  it( "only & --only=false", () => {

    expect.assertions( 3 );

    const runner = Runner.init( { allowNoPlan: true, only: false } );
    const results = runner.listen();
    const t = runner.test;

    const actual = [];
    const expected = [
      "test 1",
      "test 2",
      "group test"
    ];

    t.serial( () => {
      actual.push( "test 1" );
    } );

    t( () => {
      actual.push( "test 2" );
    } );

    t.group( () => {

      t.only( () => {
        actual.push( "group test" );
      } );

      t.failing.serial( () => {
        /* istanbul ignore next */
        actual.push( "dont run" );
      } );

      t.skip( () => {
        /* istanbul ignore next */
        actual.push( "dont run" );
      } );

    } );

    return runner.run().then( () => {
      expect( actual ).toEqual( expected );
      expect( results[ results.length - 1 ].onlyCount ).toBe( 1 );
      expect( results[ results.length - 1 ].testCounts ).toEqual( {
        failed: 0,
        passed: 3,
        skipped: 0,
        todo: 0,
        total: 3
      } );
    } );

  } );

} );
