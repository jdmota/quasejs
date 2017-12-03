#!/usr/bin/env node

const help = `
Usage
  $ quase-unit <files> [options]

Options
  --match, -m             Only run tests with matching title (Can be repeated)
  --watch, -w             Watch files for changes and re-run the related tests
  --fail-fast             Stop after first test failure
  --concurrency, -c       Max number of test files running at the same time (Default: CPU logical cores or 2 if running in CI)
  --update-snapshots, -u  Update snapshots
  --timeout, -t           Set global timeout
  --seed [value]          Specify a seed to order your tests; if option is specified without a value, one will be generated
  --reporter <name>       Specify the reporter to use; if no match is found a list of available reporters will be displayed
  --color                 Use color output. (Default: true)
`;

require( "@quase/cli" ).default( function( o ) {
  require( "../dist/cli" ).default( o );
}, {
  help,
  inferType: true,
  defaultConfigFile: "quase-unit-config.js",
  configKey: "quase-unit",
  flags: {
    match: {
      type: "string",
      alias: "m"
    },
    watch: {
      type: "boolean",
      alias: "w"
    },
    failFast: {
      type: "boolean"
    },
    concurrency: {
      type: "number",
      alias: "c"
    },
    updateSnapshots: {
      type: "boolean",
      alias: "u"
    },
    timeout: {
      type: "number",
      alias: "t"
    },
    color: {
      type: "boolean",
      default: true
    },
    reporter: {
      type: "string"
    }
  }
} );
