import Runner from "../../src/core/runner";
import assert from "../../../assert";

describe( "unit", () => {

  it( "context", () => {

    assert.expect( 12 );

    let runner = Runner.init( { allowNoPlan: true } );
    let results = runner.listen();
    let t = runner.test;
    let runCount = 0;

    t.before( ( { context } ) => {
      assert.ok( !context.ran );
      assert.ok( !context.shared );
      context.ran = true;
      runCount++;
    } );

    t.after( ( { context } ) => {
      assert.ok( !context.ran );
      assert.ok( !context.shared );
      context.ran = true;
      runCount++;
    } );

    t.beforeEach( ( { context } ) => {
      assert.ok( !context.ran );
      assert.ok( !context.shared );
      context.ran = true;
      context.shared = true;
      runCount++;
    } );

    t.afterEach( ( { context } ) => {
      assert.ok( context.ran );
      assert.ok( context.shared );
      runCount++;
    } );

    t( ( { context } ) => {
      assert.ok( context.ran );
      assert.ok( context.shared );
      runCount++;
    } );

    return runner.run().then( () => {
      assert.strictEqual( runCount, 5 );
      assert.strictEqual( results.pop().status, "passed" );
    } );

  } );

  it( "context in nested groups", () => {

    assert.expect( 24 );

    let runner = Runner.init( { allowNoPlan: true } );
    let results = runner.listen();
    let t = runner.test;
    let runCount = 0;

    t.before( ( { context } ) => {
      assert.ok( !context.ran );
      assert.ok( !context.shared );
      context.ran = true;
      runCount++;
    } );

    t.after( ( { context } ) => {
      assert.ok( !context.ran );
      assert.ok( !context.shared );
      context.ran = true;
      runCount++;
    } );

    t.beforeEach( ( { context } ) => {
      assert.ok( !context.ran );
      assert.ok( !context.shared );
      assert.ok( !context.count );
      context.ran = true;
      context.shared = true;
      context.count = 1;
      runCount++;
    } );

    t.group( () => {

      t.group( () => {

        t( ( { context } ) => {
          assert.ok( context.ran );
          assert.ok( context.shared );
          assert.strictEqual( context.count, 1 );
          context.count++;
          runCount++;
        } );

      } );

      t( ( { context } ) => {
        assert.ok( context.ran );
        assert.ok( context.shared );
        assert.strictEqual( context.count, 1 );
        context.count++;
        runCount++;
      } );

    } );

    t.afterEach( ( { context } ) => {
      assert.ok( context.ran );
      assert.ok( context.shared );
      assert.strictEqual( context.count, 2 );
      runCount++;
    } );

    return runner.run().then( () => {
      assert.strictEqual( runCount, 8 );
      assert.strictEqual( results.pop().status, "passed" );
    } );

  } );

} );
