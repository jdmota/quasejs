const unit = require( "../src" );
const runner = unit.Runner.init();

unit.reporters.Node.init( runner );

runner.run();
