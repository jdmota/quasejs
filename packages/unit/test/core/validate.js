import { Runner } from "../../src";
import assert from "../../../assert";

describe( "unit", () => {

  [ "only", "failing", "todo", "skip" ].forEach( type => {

    it( type + " not allowed in strict mode", () => {

      const runner = Runner.init( {
        strict: true
      } );

      assert.throws( () => {
        runner.test[ type ]( () => {} );
      }, /modifiers are not allowed in strict mode/ );

    } );

  } );

  [ "only", "failing", "todo", "skip" ].forEach( type => {

    it( type + " not allowed in strict mode (using strict modifier)", () => {

      const runner = Runner.init();
      let fineHere = false;

      assert.throws( () => {
        runner.test.skip( () => {} );
        fineHere = true;
        runner.group.strict( () => {
          runner.test[ type ]( () => {} );
        } );
      }, /modifiers are not allowed in strict mode/ );

      expect( fineHere ).toBe( true );

    } );

  } );

} );
