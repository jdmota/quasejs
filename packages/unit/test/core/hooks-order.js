import Runner from "../../src/core/runner";

describe( "unit", () => {

  it( "hooks order", () => {

    expect.assertions( 1 );

    let runner = Runner.init( { allowNoPlan: true } );
    let t = runner.test;

    let actual = [];
    let expected = [
      "group",
      "before",
      "beforeEach",
      "test",
      "afterEach",
      "afterEach 2",
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
      actual.push( "test" );
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

} );
