import Runner from "../../src/core/runner";
import assert from "../../../assert";

describe( "unit", () => {

  it( "todo", () => {

    assert.expect( 1 );

    const runner = Runner.init();
    const results = runner.listen();
    const t = runner.test;

    t.todo( "test1" );

    t.todo( "test2", () => {
      /* istanbul ignore next */
      assert.ok( false );
    } );

    return runner.run().then( () => {
      assert.strictEqual( results.pop().status, "todo" );
    } );

  } );

  it( "todo in group", () => {

    assert.expect( 1 );

    const runner = Runner.init();
    const results = runner.listen();
    const t = runner.test;

    t.beforeEach( () => {
      /* istanbul ignore next */
      assert.ok( false );
    } );

    t.group.todo( () => {

      t.group( () => {

        t( () => {
          /* istanbul ignore next */
          assert.ok( false );
        } );

        t( () => {
          /* istanbul ignore next */
          assert.ok( false );
        } );

      } );

      t( () => {
        /* istanbul ignore next */
        assert.ok( false );
      } );

      t( () => {
        /* istanbul ignore next */
        assert.ok( false );
      } );

    } );

    t.afterEach( () => {
      /* istanbul ignore next */
      assert.ok( false );
    } );

    return runner.run().then( () => {
      assert.deepEqual( results.pop().testCounts, {
        failed: 0,
        passed: 0,
        skipped: 0,
        todo: 4,
        total: 4
      } );
    } );

  } );

  it( "failing in group + todo test", () => {

    assert.expect( 1 );

    const runner = Runner.init( { allowNoPlan: true } );
    const results = runner.listen();
    const t = runner.test;

    t.group.failing( () => {

      t.todo( () => {
        /* istanbul ignore next */
        assert.ok( false );
      } );

    } );

    return runner.run().then( () => {
      assert.strictEqual( results.pop().status, "todo" );
    } );

  } );

} );
