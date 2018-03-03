import Runner from "../../src/core/runner";

describe( "unit", () => {

  it( "context", () => {

    expect.assertions( 12 );

    let runner = Runner.init( { allowNoPlan: true } );
    let results = runner.listen();
    let t = runner.test;
    let runCount = 0;

    t.before( ( { context } ) => {
      expect( context.ran ).toBe( undefined );
      expect( context.shared ).toBe( undefined );
      context.ran = true;
      runCount++;
    } );

    t.after( ( { context } ) => {
      expect( context.ran ).toBe( undefined );
      expect( context.shared ).toBe( undefined );
      context.ran = true;
      runCount++;
    } );

    t.beforeEach( ( { context } ) => {
      expect( context.ran ).toBe( undefined );
      expect( context.shared ).toBe( undefined );
      context.ran = true;
      context.shared = true;
      runCount++;
    } );

    t.afterEach( ( { context } ) => {
      expect( context.ran ).toBe( true );
      expect( context.shared ).toBe( true );
      runCount++;
    } );

    t( ( { context } ) => {
      expect( context.ran ).toBe( true );
      expect( context.shared ).toBe( true );
      runCount++;
    } );

    return runner.run().then( () => {
      expect( runCount ).toBe( 5 );
      expect( results.pop().status ).toBe( "passed" );
    } );

  } );

  it( "context in nested groups", () => {

    expect.assertions( 24 );

    let runner = Runner.init( { allowNoPlan: true } );
    let results = runner.listen();
    let t = runner.test;
    let runCount = 0;

    t.before( ( { context } ) => {
      expect( context.ran ).toBe( undefined );
      expect( context.shared ).toBe( undefined );
      context.ran = true;
      runCount++;
    } );

    t.after( ( { context } ) => {
      expect( context.ran ).toBe( undefined );
      expect( context.shared ).toBe( undefined );
      context.ran = true;
      runCount++;
    } );

    t.beforeEach( ( { context } ) => {
      expect( context.ran ).toBe( undefined );
      expect( context.shared ).toBe( undefined );
      expect( context.count ).toBe( undefined );
      context.ran = true;
      context.shared = true;
      context.count = 1;
      runCount++;
    } );

    t.group( () => {

      t.group( () => {

        t( ( { context } ) => {
          expect( context.ran ).toBe( true );
          expect( context.shared ).toBe( true );
          expect( context.count ).toBe( 1 );
          context.count++;
          runCount++;
        } );

      } );

      t( ( { context } ) => {
        expect( context.ran ).toBe( true );
        expect( context.shared ).toBe( true );
        expect( context.count ).toBe( 1 );
        context.count++;
        runCount++;
      } );

    } );

    t.afterEach( ( { context } ) => {
      expect( context.ran ).toBe( true );
      expect( context.shared ).toBe( true );
      expect( context.count ).toBe( 2 );
      runCount++;
    } );

    return runner.run().then( () => {
      expect( runCount ).toBe( 8 );
      expect( results.pop().status ).toBe( "passed" );
    } );

  } );

} );
