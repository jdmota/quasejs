const unit = require( "../src" ).default;
const runner = unit.Runner.init();

unit.reporters.Node.init( runner );

runner.run();
