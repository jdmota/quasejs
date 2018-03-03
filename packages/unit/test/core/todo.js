import Runner from "../../src/core/runner";

describe( "unit", () => {

  it( "todo", () => {

    expect.assertions( 1 );

    const runner = Runner.init();
    const results = runner.listen();
    const t = runner.test;

    t.todo( "test1" );

    t.todo( "test2", () => {
      /* istanbul ignore next */
      expect( false ).toBe( true );
    } );

    return runner.run().then( () => {
      expect( results.pop().status ).toBe( "todo" );
    } );

  } );

  it( "todo in group", () => {

    expect.assertions( 1 );

    const runner = Runner.init();
    const results = runner.listen();
    const t = runner.test;

    t.beforeEach( () => {
      /* istanbul ignore next */
      expect( false ).toBe( true );
    } );

    t.group.todo( () => {

      t.group( () => {

        t( () => {
          /* istanbul ignore next */
          expect( false ).toBe( true );
        } );

        t( () => {
          /* istanbul ignore next */
          expect( false ).toBe( true );
        } );

      } );

      t( () => {
        /* istanbul ignore next */
        expect( false ).toBe( true );
      } );

      t( () => {
        /* istanbul ignore next */
        expect( false ).toBe( true );
      } );

    } );

    t.afterEach( () => {
      /* istanbul ignore next */
      expect( false ).toBe( true );
    } );

    return runner.run().then( () => {
      expect( results.pop().testCounts ).toEqual( {
        failed: 0,
        passed: 0,
        skipped: 0,
        todo: 4,
        total: 4
      } );
    } );

  } );

  it( "failing in group + todo test", () => {

    expect.assertions( 1 );

    const runner = Runner.init( { allowNoPlan: true } );
    const results = runner.listen();
    const t = runner.test;

    t.group.failing( () => {

      t.todo( () => {
        /* istanbul ignore next */
        expect( false ).toBe( true );
      } );

    } );

    return runner.run().then( () => {
      expect( results.pop().status ).toBe( "todo" );
    } );

  } );

} );
