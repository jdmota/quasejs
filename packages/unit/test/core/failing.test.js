import Runner from "../../src/core/runner";

describe( "unit", () => {

  it( "failing", () => {

    expect.assertions( 10 );

    let runner = Runner.init( { allowNoPlan: true } );
    let results = runner.listen();
    let t = runner.test;

    t.failing( "failing test", () => {
      throw new Error( "abc" );
    } );

    t.failing( "failing test 2", () => {} );

    return runner.run().then( () => {

      expect( results[ 2 ] ).toBe( "testStart" );

      expect( results[ 3 ] ).toEqual( {
        name: "failing test",
        fullname: [ "failing test" ],
        suiteName: ""
      } );

      expect( results[ 4 ] ).toEqual( "testEnd" );
      expect( results[ 5 ].status ).toEqual( "passed" );

      expect( results[ 6 ] ).toBe( "testStart" );

      expect( results[ 7 ] ).toEqual( {
        name: "failing test 2",
        fullname: [ "failing test 2" ],
        suiteName: ""
      } );

      expect( results[ 8 ] ).toBe( "testEnd" );
      expect( results[ 9 ].status ).toBe( "failed" );
      expect(
        results[ 9 ].errors[ 0 ].message
      ).toBe(
        "Test was expected to fail, but succeeded, you should stop marking the test as failing."
      );

      expect( results.pop().status ).toBe( "failed" );

    } );

  } );

  it( "failing in groups", () => {

    expect.assertions( 9 );

    let runner = Runner.init( { allowNoPlan: true } );
    let results = runner.listen();
    let t = runner.test;

    t.group.failing( "group", () => {

      t( "failing test", () => {
        throw new Error( "abc" );
      } );

      t( "failing test 2", () => {
        throw new Error( "abc" );
      } );

    } );

    return runner.run().then( () => {

      expect( results[ 4 ] ).toBe( "testStart" );

      expect( results[ 5 ] ).toEqual( {
        name: "failing test",
        fullname: [ "group", "failing test" ],
        suiteName: "group"
      } );

      expect( results[ 6 ] ).toEqual( "testEnd" );
      expect( results[ 7 ].status ).toEqual( "passed" );

      expect( results[ 8 ] ).toBe( "testStart" );

      expect( results[ 9 ] ).toEqual( {
        name: "failing test 2",
        fullname: [ "group", "failing test 2" ],
        suiteName: "group"
      } );

      expect( results[ 10 ] ).toBe( "testEnd" );
      expect( results[ 11 ].status ).toBe( "passed" );

      expect( results.pop().status ).toBe( "passed" );

    } );

  } );

  it( "failing in groups 2", () => {

    expect.assertions( 10 );

    let runner = Runner.init( { allowNoPlan: true } );
    let results = runner.listen();
    let t = runner.test;

    t.group.failing( "group", () => {

      t( "failing test", () => {
        throw new Error( "abc" );
      } );

      t( "failing test 2", () => {} );

    } );

    return runner.run().then( () => {

      expect( results[ 4 ] ).toBe( "testStart" );

      expect( results[ 5 ] ).toEqual( {
        name: "failing test",
        fullname: [ "group", "failing test" ],
        suiteName: "group"
      } );

      expect( results[ 6 ] ).toEqual( "testEnd" );
      expect( results[ 7 ].status ).toEqual( "passed" );

      expect( results[ 8 ] ).toBe( "testStart" );

      expect( results[ 9 ] ).toEqual( {
        name: "failing test 2",
        fullname: [ "group", "failing test 2" ],
        suiteName: "group"
      } );

      expect( results[ 10 ] ).toBe( "testEnd" );
      expect( results[ 11 ].status ).toBe( "failed" );
      expect(
        results[ 11 ].errors[ 0 ].message
      ).toBe(
        "Test was expected to fail, but succeeded, you should stop marking the test as failing."
      );

      expect( results.pop().status ).toBe( "failed" );

    } );

  } );

  it( "failing in groups 3", () => {

    expect.assertions( 10 );

    let runner = Runner.init( { allowNoPlan: true } );
    let results = runner.listen();
    let t = runner.test;

    t.group.failing( "root", () => {

      t.group( "group", () => {

        t( "failing test", () => {
          throw new Error( "abc" );
        } );

        t( "failing test 2", () => {} );

      } );

    } );

    return runner.run().then( () => {

      expect( results[ 6 ] ).toBe( "testStart" );

      expect( results[ 7 ] ).toEqual( {
        name: "failing test",
        fullname: [ "root", "group", "failing test" ],
        suiteName: "group"
      } );

      expect( results[ 8 ] ).toEqual( "testEnd" );
      expect( results[ 9 ].status ).toEqual( "passed" );

      expect( results[ 10 ] ).toBe( "testStart" );

      expect( results[ 11 ] ).toEqual( {
        name: "failing test 2",
        fullname: [ "root", "group", "failing test 2" ],
        suiteName: "group"
      } );

      expect( results[ 12 ] ).toBe( "testEnd" );
      expect( results[ 13 ].status ).toBe( "failed" );
      expect(
        results[ 13 ].errors[ 0 ].message
      ).toBe(
        "Test was expected to fail, but succeeded, you should stop marking the test as failing."
      );

      expect( results.pop().status ).toBe( "failed" );

    } );

  } );

  it( "failing in groups with beforeEach", () => {

    expect.assertions( 2 );

    let runner = Runner.init( { allowNoPlan: true } );
    let results = runner.listen();
    let t = runner.test;
    let actual = [];

    t.group.failing( "group", () => {

      t.beforeEach( () => {
        throw new Error( "abc" );
      } );

      t( () => {
        /* istanbul ignore next */
        actual.push( "don't run" );
      } );

    } );

    return runner.run().then( () => {
      expect( results.pop().status ).toBe( "passed" );
      expect( actual ).toEqual( [] );
    } );

  } );

  it( "failing in group + skip test", () => {

    expect.assertions( 1 );

    const runner = Runner.init( { allowNoPlan: true } );
    const results = runner.listen();
    const t = runner.test;

    t.group.failing( () => {

      t.skip( () => {
        /* istanbul ignore next */
        expect( false ).toBe( true );
      } );

    } );

    return runner.run().then( () => {
      expect( results.pop().status ).toBe( "skipped" );
    } );

  } );

  it( "todo in group + failing test", () => {

    expect.assertions( 1 );

    const runner = Runner.init();
    const results = runner.listen();
    const t = runner.test;

    t.group.todo( () => {

      t.failing( () => {
        /* istanbul ignore next */
        expect( false ).toBe( true );
      } );

    } );

    return runner.run().then( () => {
      expect( results.pop().status ).toBe( "todo" );
    } );

  } );

} );
