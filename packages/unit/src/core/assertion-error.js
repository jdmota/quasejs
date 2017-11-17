// @flow

const { getStack } = require( "@quase/error" );

export default class AssertionError extends Error {
  +passed: boolean;
  diff: ?string;
  actual: any;
  expected: any;
  constructor( message: string ) {
    super( message );
    this.name = "AssertionError";
    this.passed = false;
    this.diff = undefined;
    this.actual = undefined;
    this.expected = undefined;
    this.stack = getStack( 2 );
  }
}
