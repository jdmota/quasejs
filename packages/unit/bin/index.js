#!/usr/bin/env node

const help = `
Usage
  $ quase-unit <files> [options]

Options
  --reporter <name>  Specify the reporter to use; if no match is found a list of available reporters will be displayed
  --seed [value]     Specify a seed to order your tests; if option is specified without a value, one will be generated
  --watch            Watch files for changes and re-run the related tests
  --concurrency, -c  Max number of test files running at the same time (Default: CPU logical cores or 2 if running in CI)
`;

require( "@quase/cli" ).default( function( o ) {
  require( "../dist/cli" ).default(
    Object.assign( {}, o.config || o.pkg[ "quase-unit" ], o.flags ),
    o.input
  );
}, {
  help,
  inferType: true,
  defaultConfigFile: "quase-unit-config.js",
  flags: {
    concurrency: {
      type: "number",
      alias: "c"
    }
  }
} );
