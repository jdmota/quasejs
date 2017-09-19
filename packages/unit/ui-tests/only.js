const unit = require( "../dist" );
const runner = unit.Runner.init();
const test = runner.test;

unit.reporters.Node.init( runner );

test( "Test 1", () => {
  throw new Error();
} );

test.only( "Test 2", () => {

} );

test( "Test 3", () => {
  throw new Error();
} );

runner.run();
