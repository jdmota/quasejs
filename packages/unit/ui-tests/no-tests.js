const unit = require( "../dist" );
const runner = unit.Runner.init();

unit.reporters.Node.init( runner );

runner.run();
