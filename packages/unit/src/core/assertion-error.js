import { getStack } from "../../../error/src";

function AssertionError( details ) {
  this.name = "AssertionError";
  this.passed = false;
  this.actual = details.actual;
  this.expected = details.expected;
  this.message = details.message;
  this.stack = getStack( 2 );
}

AssertionError.prototype = Object.create( Error.prototype );
AssertionError.prototype.constructor = AssertionError;

export default AssertionError;
