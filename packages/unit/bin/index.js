#!/usr/bin/env node

const help = `
Usage
  $ quase-unit <files|globs> [options]

Options
  --match, -m             Only run tests with matching title (Can be repeated)
  --watch, -w             Watch files for changes and re-run the related tests
  --bail                  Stop after first test failure
  --force-serial          Run tests serially. It forces --concurrency=1
  --concurrency, -c       Max number of test files running at the same time (Default: CPU logical cores or 2 if running in CI)
  --update-snapshots, -u  Update snapshots
  --timeout, -t           Set global timeout
  --random [seed]         Randomize your tests. Optionally specify a seed or one will be generated
  --env=<environment>     The test environment used for all tests. This can point to any file or node module.
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
      alias: "w",
      default: false
    },
    bail: {
      type: "boolean",
      default: false
    },
    forceSerial: {
      type: "boolean",
      default: false
    },
    concurrency: {
      type: "number",
      alias: "c"
    },
    updateSnapshots: {
      type: "boolean",
      alias: "u",
      default: false
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
