// @flow

const { getStack } = require( "@quase/error" );

export default class AssertionError extends Error {
  +passed: boolean;
  diff: ?string;
  actual: any;
  expected: any;
  actualDescribe: ?any;
  expectedDescribe: ?any;
  constructor( message: string ) {
    super( message );
    this.name = "AssertionError";
    this.passed = false;
    this.diff = undefined;
    this.actual = undefined;
    this.expected = undefined;
    this.actualDescribe = undefined;
    this.expectedDescribe = undefined;
    this.stack = getStack( 2 );
  }
}
