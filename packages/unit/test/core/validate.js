import Runner from "../../src/core/runner";

describe( "unit", () => {

  [ "only", "failing", "todo", "skip" ].forEach( type => {

    it( type + " not allowed in strict mode", () => {

      const runner = Runner.init( {
        strict: true
      } );

      expect( () => {
        runner.test[ type ]( () => {} );
      } ).toThrow( /modifiers are not allowed in strict mode/ );

    } );

  } );

  [ "only", "failing", "todo", "skip" ].forEach( type => {

    it( type + " not allowed in strict mode (using strict modifier)", () => {

      const runner = Runner.init();
      let fineHere = false;

      expect( () => {
        runner.test.skip( () => {} );
        fineHere = true;
        runner.group.strict( () => {
          runner.test[ type ]( () => {} );
        } );
      } ).toThrow( /modifiers are not allowed in strict mode/ );

      expect( fineHere ).toBe( true );

    } );

  } );

} );
