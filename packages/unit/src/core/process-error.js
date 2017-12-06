// @flow
import AssertionError from "./assertion-error";

const concordance = require( "concordance" );

export function processStack( err: Object, stack: ?string ) {
  if ( stack && err.message ) {
    return stack.replace( /^Error.*\n/, `Error: ${err.message}\n` );
  }
  return stack || err.stack;
}

export function processError( e: string | Object, stack: ?string, concordanceOptions: Object ) {
  const err = e == null || typeof e === "string" ? new AssertionError( e + "" ) : e;
  err.stack = processStack( err, stack );
  if ( err.actual !== undefined || err.expected !== undefined ) {
    const actualDescribe = concordance.describe( err.actual, concordanceOptions );
    const expectedDescribe = concordance.describe( err.expected, concordanceOptions );
    err.diff = concordance.diffDescriptors( expectedDescribe, actualDescribe, concordanceOptions );
  } else if ( err.actualDescribe !== undefined && err.expectedDescribe !== undefined ) {
    const actualDescribe = err.actualDescribe;
    const expectedDescribe = err.expectedDescribe;
    err.diff = concordance.diffDescriptors( expectedDescribe, actualDescribe, concordanceOptions );
  }
  return err;
}