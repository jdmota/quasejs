import Runner from "../../src/core/runner";

describe( "unit", () => {

  it( "skip", () => {

    expect.assertions( 1 );

    let runner = Runner.init( { allowNoPlan: true } );
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

    t.skip( () => {
      /* istanbul ignore next */
      actual.push( "dont run" );
    } );

    t.skip( () => {
      /* istanbul ignore next */
      actual.push( "dont run" );
    } );

    t.group( () => {

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

      t( () => {
        actual.push( "group test" );
      } );

      t.skip( () => {
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
    } );

  } );

  it( "skip works with groups", () => {

    expect.assertions( 2 );

    let runner = Runner.init( { allowNoPlan: true } );
    let results = runner.listen();
    let t = runner.test;

    let actual = [];
    let expected = [
      "group"
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
      /* istanbul ignore next */
      actual.push( "beforeEach" );
    } );

    t.skip( () => {
      /* istanbul ignore next */
      actual.push( "dont run" );
    } );

    t.skip( () => {
      /* istanbul ignore next */
      actual.push( "dont run" );
    } );

    t.group.skip( () => {

      actual.push( "group" );

      t( () => {
        /* istanbul ignore next */
        actual.push( "dont run" );
      } );

      t( () => {
        /* istanbul ignore next */
        actual.push( "dont run" );
      } );

    } );

    t.afterEach( () => {
      /* istanbul ignore next */
      actual.push( "afterEach" );
    } );

    t.afterEach( () => {
      /* istanbul ignore next */
      actual.push( "afterEach 2" );
    } );

    return runner.run().then( () => {
      expect( actual ).toEqual( expected );
      expect( results.pop().testCounts ).toEqual( {
        failed: 0,
        passed: 0,
        skipped: 4,
        todo: 0,
        total: 4
      } );
    } );

  } );

  it( "skip in the test", () => {

    expect.assertions( 3 );

    let runner = Runner.init( { allowNoPlan: true } );
    let results = runner.listen();
    let t = runner.test;

    let actual = [];
    let expected = [
      "test 1",
      "test 2"
    ];

    t( () => {
      actual.push( "test 1" );
    } );

    t( function( p ) {
      actual.push( "test 2" );
      p.skip( "reason for skipping" );
      /* istanbul ignore next */
      actual.push( "dont run after skip()" );
    } );

    return runner.run().then( () => {
      expect( actual ).toEqual( expected );
      expect( results[ 9 ].skipReason ).toBe( "reason for skipping" );
      expect( results[ 11 ].testCounts ).toEqual( {
        failed: 0,
        passed: 1,
        skipped: 1,
        todo: 0,
        total: 2
      } );
    } );

  } );

  it( "skip inside Promise in the test", () => {

    expect.assertions( 3 );

    let runner = Runner.init( { allowNoPlan: true } );
    let results = runner.listen();
    let t = runner.test;

    let actual = [];
    let expected = [
      "test 1",
      "test 2"
    ];

    t( () => {
      actual.push( "test 1" );
    } );

    t( function( p ) {
      actual.push( "test 2" );
      return new Promise( resolve => resolve() ).then( () => p.skip( "reason for skipping in promise" ) );
    } );

    return runner.run().then( () => {
      expect( actual ).toEqual( expected );
      expect( results[ 9 ].skipReason ).toBe( "reason for skipping in promise" );
      expect( results[ 11 ].testCounts ).toEqual( {
        failed: 0,
        passed: 1,
        skipped: 1,
        todo: 0,
        total: 2
      } );
    } );

  } );

  it( "skip in the beforeHook", () => {

    expect.assertions( 2 );

    let runner = Runner.init( { allowNoPlan: true } );
    let results = runner.listen();
    let t = runner.test;

    let actual = [];
    let expected = [
      "before",
      "after"
    ];

    t.before( function( p ) {
      actual.push( "before" );
      p.skip();
      /* istanbul ignore next */
      actual.push( "dont run after skip()" );
    } );

    t.after( () => {
      actual.push( "after" );
    } );

    t( () => {
      /* istanbul ignore next */
      actual.push( "dont run test" );
    } );

    return runner.run().then( () => {
      expect( actual ).toEqual( expected );
      expect( results[ 15 ].testCounts ).toEqual( {
        failed: 0,
        passed: 1,
        skipped: 2,
        todo: 0,
        total: 3
      } );
    } );

  } );

  it( "skip inside Promise in the beforeHook", () => {

    expect.assertions( 2 );

    let runner = Runner.init( { allowNoPlan: true } );
    let results = runner.listen();
    let t = runner.test;

    let actual = [];
    let expected = [
      "before",
      "after"
    ];

    t.before( function( p ) {
      actual.push( "before" );
      return new Promise( resolve => resolve() ).then( () => p.skip() );
    } );

    t.after( () => {
      actual.push( "after" );
    } );

    t( () => {
      /* istanbul ignore next */
      actual.push( "dont run test" );
    } );

    return runner.run().then( () => {
      expect( actual ).toEqual( expected );
      expect( results[ 15 ].testCounts ).toEqual( {
        failed: 0,
        passed: 1,
        skipped: 2,
        todo: 0,
        total: 3
      } );
    } );

  } );

  it( "skip modifier in before hook should not affect tests", () => {

    expect.assertions( 2 );

    let runner = Runner.init( { allowNoPlan: true } );
    let results = runner.listen();
    let t = runner.test;

    let actual = [];
    let expected = [
      "test",
      "after"
    ];

    t.skip.before( () => {
      /* istanbul ignore next */
      actual.push( "dont run" );
    } );

    t.after( () => {
      actual.push( "after" );
    } );

    t( () => {
      actual.push( "test" );
    } );

    return runner.run().then( () => {
      expect( actual ).toEqual( expected );
      expect( results.pop().testCounts ).toEqual( {
        failed: 0,
        passed: 2,
        skipped: 1,
        todo: 0,
        total: 3
      } );
    } );

  } );

  it( "don't run before/after when tests are skipped", () => {

    expect.assertions( 1 );

    let runner = Runner.init( { allowNoPlan: true } );
    let t = runner.test;

    let actual = [];
    let expected = [];

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

    t.skip( () => {
      /* istanbul ignore next */
      actual.push( "dont run" );
    } );

    t.skip( () => {
      /* istanbul ignore next */
      actual.push( "dont run" );
    } );

    t.group( () => {

      t.skip( () => {
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
    } );

  } );

  it( "don't run before/after when related tests are skipped", () => {

    expect.assertions( 1 );

    let runner = Runner.init( { allowNoPlan: true } );
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

    t.after( () => {
      actual.push( "after" );
    } );

    t( () => {
      actual.push( "test" );
    } );

    t.group( () => {

      t.before( () => {
        actual.push( "before 2" );
      } );

      t.skip( () => {
        /* istanbul ignore next */
        actual.push( "dont run" );
      } );

    } );

    return runner.run().then( () => {
      expect( actual ).toEqual( expected );
    } );

  } );

  it( "don't run before/after when related tests are skipped + delayed setup", () => {

    expect.assertions( 1 );

    let runner = Runner.init( { allowNoPlan: true } );
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

    t.after( () => {
      actual.push( "after" );
    } );

    t( () => {
      actual.push( "test" );
    } );

    t.group( function( g ) {

      g.before( () => {
        actual.push( "before 2" );
      } );

      return Promise.resolve().then( () => {
        g.skip( () => {
          /* istanbul ignore next */
          actual.push( "dont run" );
        } );
      } );

    } );

    return runner.run().then( () => {
      expect( actual ).toEqual( expected );
    } );

  } );

} );
