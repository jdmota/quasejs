import Runner from "../../src/core/runner";

describe( "unit", () => {

  it( "global force serial", () => {

    expect.assertions( 4 );

    let timeouts = 0;
    let called = 0;

    function timeout() {
      return new Promise( resolve => {
        timeouts++;
        setTimeout( resolve, 5 );
      } ).then( () => {
        called++;
      } );
    }

    let runner = Runner.init( { forceSerial: true } );
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
      "test 2",
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
      return timeout();
    } );

    t.after( () => {
      actual.push( "after" );
      return timeout();
    } );

    t.after( () => {
      actual.push( "after 2" );
    } );

    t.beforeEach( () => {
      actual.push( "beforeEach" );
      return timeout();
    } );

    t( () => {
      actual.push( "test" );
      return timeout();
    } );

    t( () => {
      actual.push( "test 2" );
      return timeout();
    } );

    t.group( group => {

      expect( group.forceSerial() ).toBe( true );

      actual.push( "group" );

      t.beforeEach( () => {
        actual.push( "group beforeEach" );
      } );

      t.afterEach( () => {
        actual.push( "group afterEach" );
        return timeout();
      } );

      t.beforeEach( () => {
        actual.push( "group beforeEach 2" );
      } );

      t.afterEach( () => {
        actual.push( "group afterEach 2" );
      } );

      t( () => {
        actual.push( "group test" );
        return timeout();
      } );

    } );

    t.afterEach( () => {
      actual.push( "afterEach" );
    } );

    t.afterEach( () => {
      actual.push( "afterEach 2" );
      return timeout();
    } );

    return runner.run().then( () => {
      expect( actual ).toEqual( expected );
      expect( timeouts ).toBe( 12 );
      expect( called ).toBe( timeouts );
    } );

  } );

  it( "local force serial", () => {

    expect.assertions( 5 );

    let timeouts = 0;
    let called = 0;

    function timeout() {
      return new Promise( resolve => {
        timeouts++;
        setTimeout( resolve, 5 );
      } ).then( () => {
        called++;
      } );
    }

    let runner = Runner.init();
    let t = runner.test;

    let actual = [];
    let expected = [
      "group",
      "group beforeEach",
      "group test",
      "group afterEach",
      "group beforeEach",
      "group test 2",
      "group afterEach",
    ];

    t.group( group => {

      expect( group.forceSerial() ).toBe( false );
      group.forceSerial( true );
      expect( group.forceSerial() ).toBe( true );

      actual.push( "group" );

      t.beforeEach( () => {
        actual.push( "group beforeEach" );
        return timeout();
      } );

      t.afterEach( () => {
        actual.push( "group afterEach" );
        return timeout();
      } );

      t( () => {
        actual.push( "group test" );
        return timeout();
      } );

      t( () => {
        actual.push( "group test 2" );
        return timeout();
      } );

    } );

    return runner.run().then( () => {
      expect( actual ).toEqual( expected );
      expect( timeouts ).toBe( 6 );
      expect( called ).toBe( timeouts );
    } );

  } );

} );
