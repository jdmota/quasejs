import Runner from "../../src/core/runner";

/* eslint no-console: 0 */
/* global window */

describe( "unit", () => {

  it( "noglobals", () => {

    expect.assertions( 2 );

    let runner = Runner.init( {
      globals: false
    } );
    let results = runner.listen();
    let test = runner.test;

    test( () => {

      if ( typeof global === "undefined" ) {
        /* istanbul ignore next */
        window.abc = 10;
      } else {
        global.abc = 10;
      }

    } );

    test.after( () => {} );

    return runner.run().then( () => {

      expect( results[ 5 ].errors[ 0 ].message ).toBe( "Introduced global variable(s): abc" );
      expect( results.pop().status ).toBe( "failed" );

      if ( typeof global === "undefined" ) {
        /* istanbul ignore next */
        delete window.abc;
      } else {
        delete global.abc;
      }

    } );

  } );

  it( "noglobals 2", () => {

    expect.assertions( 2 );

    let runner = Runner.init( {
      globals: false
    } );
    let results = runner.listen();
    let test = runner.test;

    test( () => {

      if ( typeof global === "undefined" ) {
        /* istanbul ignore next */
        delete window.abc;
      } else {
        delete global.abc;
      }

    } );

    test.after( () => {} );

    if ( typeof global === "undefined" ) {
      /* istanbul ignore next */
      window.abc = 10;
    } else {
      global.abc = 10;
    }

    return runner.run().then( () => {
      expect( results[ 5 ].errors[ 0 ].message ).toBe( "Deleted global variable(s): abc" );
      expect( results.pop().status ).toBe( "failed" );
    } );

  } );

  it( "noglobals 3", () => {

    expect.assertions( 2 );

    let runner = Runner.init( {
      globals: false
    } );
    let results = runner.listen();
    let test = runner.test;

    test( () => {

      if ( typeof global === "undefined" ) {
        /* istanbul ignore next */
        delete window.abc;
      } else {
        delete global.abc;
      }

      if ( typeof global === "undefined" ) {
        /* istanbul ignore next */
        window.cba = 10;
      } else {
        global.cba = 10;
      }

    } );

    test.after( () => {} );

    if ( typeof global === "undefined" ) {
      /* istanbul ignore next */
      window.abc = 10;
    } else {
      global.abc = 10;
    }

    return runner.run().then( () => {

      expect(
        results[ 5 ].errors[ 0 ].message
      ).toBe(
        "Introduced global variable(s): cba; Deleted global variable(s): abc"
      );

      expect( results.pop().status ).toBe( "failed" );

      if ( typeof global === "undefined" ) {
        delete window.cba;
      } else {
        /* istanbul ignore next */
        delete global.cba;
      }

    } );

  } );

  it( "noglobals - don't get tricked", () => {

    expect.assertions( 2 );

    let runner = Runner.init( {
      globals: false
    } );
    let results = runner.listen();
    let test = runner.test;

    test.serial( () => {
      if ( typeof global === "undefined" ) {
        /* istanbul ignore next */
        window.foo = 10;
      } else {
        global.foo = 10;
      }
    } );

    test.serial( () => {
      if ( typeof global === "undefined" ) {
        /* istanbul ignore next */
        delete window.foo;
      } else {
        delete global.foo;
      }
    } );

    return runner.run().then( () => {

      expect(
        results[ 5 ].errors[ 0 ].message
      ).toBe(
        "Introduced global variable(s): foo"
      );

      expect( results.pop().status ).toBe( "failed" );

    } );

  } );

  it( "allow some globals", () => {

    expect.assertions( 2 );

    const runner = Runner.init( {
      globals: [ "abc" ]
    } );
    const results = runner.listen();
    const test = runner.test;

    test( () => {

      if ( typeof global === "undefined" ) {
        /* istanbul ignore next */
        window.abc = 10;
      } else {
        global.abc = 10;
      }

      if ( typeof global === "undefined" ) {
        /* istanbul ignore next */
        window.cba = 10;
      } else {
        global.cba = 10;
      }

    } );

    test.after( () => {} );

    return runner.run().then( () => {

      expect(
        results[ 5 ].errors[ 0 ].message
      ).toBe(
        "Introduced global variable(s): cba"
      );

      expect( results.pop().status ).toBe( "failed" );

      if ( typeof global === "undefined" ) {
        /* istanbul ignore next */
        delete window.abc;
      } else {
        delete global.abc;
      }

      if ( typeof global === "undefined" ) {
        delete window.cba;
      } else {
        /* istanbul ignore next */
        delete global.cba;
      }

    } );

  } );

  it( "allow any globals", () => {

    expect.assertions( 1 );

    const runner = Runner.init( {
      globals: true,
      allowNoPlan: true
    } );
    const results = runner.listen();
    const test = runner.test;

    test( () => {

      if ( typeof global === "undefined" ) {
        /* istanbul ignore next */
        window.abc = 10;
      } else {
        global.abc = 10;
      }

      if ( typeof global === "undefined" ) {
        /* istanbul ignore next */
        window.cba = 10;
      } else {
        global.cba = 10;
      }

    } );

    test.after( () => {} );

    return runner.run().then( () => {

      expect( results.pop().status ).toBe( "passed" );

      if ( typeof global === "undefined" ) {
        /* istanbul ignore next */
        delete window.abc;
      } else {
        delete global.abc;
      }

      if ( typeof global === "undefined" ) {
        delete window.cba;
      } else {
        /* istanbul ignore next */
        delete global.cba;
      }

    } );

  } );

} );
