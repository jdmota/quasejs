import { Runner } from "../src";
import assert from "../../assert";

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

} );
