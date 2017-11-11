import { Runner } from "../../src";
import assert from "../../../assert";

describe( "unit", () => {

  it( "less assertions were run", () => {

    let runner = Runner.init();
    let results = runner.listen();
    let test = runner.test;

    test( t => {
      t.plan( 10 );
      t.incCount();
      t.incCount();
    } );

    return runner.run().then( () => {
      assert.strictEqual( results[ 5 ].errors[ 0 ].message, "Planned 10 but 2 assertions were run." );
      assert.strictEqual( results.pop().status, "failed" );
    } );

  } );

  it( "more assertions were run", () => {

    let runner = Runner.init();
    let results = runner.listen();
    let test = runner.test;

    test( t => {
      t.plan( 1 );
      t.incCount();
      t.incCount();
      t.incCount();
    } );

    return runner.run().then( () => {
      assert.strictEqual( results[ 5 ].errors[ 0 ].message, "Planned 1 but 3 assertions were run." );
      assert.strictEqual( results.pop().status, "failed" );
    } );

  } );

  it( "more assertions were run - hook", () => {

    let runner = Runner.init();
    let results = runner.listen();
    let test = runner.test;
    let didRun = false;

    test.before( t => {
      t.plan( 1 );
      t.incCount();
      t.incCount();
    } );

    test( t => {
      didRun = true;
      t.plan( 1 );
      t.incCount();
    } );

    return runner.run().then( () => {
      assert.strictEqual( results[ 5 ].errors[ 0 ].message, "Planned 1 but 2 assertions were run." );
      assert.strictEqual( results.pop().status, "failed" );
      assert.strictEqual( didRun, false );
    } );

  } );

  it( "planning succeed", () => {

    let runner = Runner.init();
    let results = runner.listen();
    let test = runner.test;

    test( t => {
      t.plan( 2 );
      t.incCount();
      t.incCount();
    } );

    return runner.run().then( () => {
      assert.strictEqual( results.pop().status, "passed" );
    } );

  } );

  it( "0 assertions error", () => {

    let runner = Runner.init();
    let results = runner.listen();
    let test = runner.test;

    test( () => {} );

    return runner.run().then( () => {
      assert.strictEqual( results[ 5 ].errors[ 0 ].message, "No assertions were run." );
      assert.strictEqual( results.pop().status, "failed" );
    } );

  } );

  it( "0 assertions should not cause error on hooks", () => {

    let runner = Runner.init();
    let results = runner.listen();
    let test = runner.test;

    test.before( () => {} );

    test.beforeEach( () => {} );

    test( t => {
      t.incCount();
    } );

    test.after( () => {} );

    test.afterEach( () => {} );

    return runner.run().then( () => {
      assert.strictEqual( results.pop().status, "passed" );
    } );

  } );

  it( "0 assertions + allowNoPlan (global)", () => {

    let runner = Runner.init( {
      allowNoPlan: true
    } );
    let results = runner.listen();
    let test = runner.test;

    test( () => {} );

    return runner.run().then( () => {
      assert.strictEqual( results.pop().status, "passed" );
    } );

  } );

  it( "0 assertions + allowNoPlan (modifier in test)", () => {

    let runner = Runner.init();
    let results = runner.listen();
    let test = runner.test;

    test.allowNoPlan( () => {} );

    return runner.run().then( () => {
      assert.strictEqual( results.pop().status, "passed" );
    } );

  } );

  it( "0 assertions + allowNoPlan (modifier in group)", () => {

    let runner = Runner.init();
    let results = runner.listen();
    let test = runner.test;

    test.group.allowNoPlan( () => {
      test( () => {} );
    } );

    return runner.run().then( () => {
      assert.strictEqual( results.pop().status, "passed" );
    } );

  } );

} );
