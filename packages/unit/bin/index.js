#!/usr/bin/env node

const help = `
Usage
  $ quase-unit [<files|globs>...] [options]

  If you provide files or globs, you override the "files" configuration.

Options
  --match, -m             Only run tests with matching title (Can be repeated)
  --watch, -w             Watch files for changes and re-run the related tests
  --bail                  Stop after first test failure
  --force-serial          Run tests serially. It forces --concurrency=1
  --concurrency, -c       Max number of test files running at the same time (Default: CPU logical cores or 2 if running in CI)
  --update-snapshots, -u  Update snapshots
  --timeout, -t           Set test timeout
  --slow                  Set "slow" test threshold
  --only                  Only run tests marked with ".only" modifier
  --allow-no-plan         Make tests still succeed if no assertions are run and no planning was done
  --strict                Disallow the usage of "only", "failing", "todo", "skipped" modifiers
  --globals [name]        Specify which global variables can be created by the tests. 'true' for any. Default is 'false'.
  --random [seed]         Randomize your tests. Optionally specify a seed or one will be generated
  --snapshot-dir          Specify a fixed location for storing the snapshot files
  --env <environment>     The test environment used for all tests. This can point to any file or node module
  --reporter <name>       Specify the reporter to use; if no match is found a list of available reporters will be displayed
  --color                 Force color output
  --no-color              Disable color output
  --no-timeouts           Disable timeouts. Given implicitly with --debug
  --no-diff               Disable the showing of a diff on failure
  --no-stack              Disable the showing of a strack trace on failure
  --no-code-frame         Disable the showing of a code frame
  --inspect               Same as --inspect on nodejs. Forces concurrency 1
  --inspect-brk           Same as --inspect-brk on nodejs. Forces concurrency 1
  --debug                 Same as --inspect-brk=0 on nodejs. Can be used with any concurrency value
  --log-heap-usage        Logs the heap usage after every test. Useful to debug memory leaks.
  --verbose               Enable verbose output
`;

require( "@quase/cli" ).default( {
  help,
  configFiles: "quase-unit-config.js",
  configKey: "quase-unit",
  schema: {
    match: {
      type: "string",
      alias: "m",
      optional: true
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
      alias: "c",
      optional: true
    },
    updateSnapshots: {
      type: "boolean",
      alias: "u",
      default: false
    },
    timeout: {
      type: "number",
      alias: "t",
      optional: true
    },
    slow: {
      type: "number",
      optional: true
    },
    allowNoPlan: {
      type: "boolean",
      default: false
    },
    only: {
      type: "boolean",
      default: false
    },
    strict: {
      type: "boolean",
      default: false
    },
    snapshotDir: {
      type: "string",
      optional: true
    },
    reporter: {
      type: "string",
      optional: true
    },
    diff: {
      type: "boolean",
      default: true
    },
    stack: {
      type: "boolean",
      default: true
    },
    codeFrame: {
      type: "boolean",
      default: true
    },
    timeouts: {
      type: "boolean",
      default: true
    },
    verbose: {
      type: "boolean",
      default: false
    }
  }
} ).then( function( o ) {
  require( "../dist/cli" ).default( o );
} );
