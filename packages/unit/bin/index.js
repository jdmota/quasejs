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
  --allow-no-plan         Make tests still succeed if no assertions are run and no planning was done
  --strict                Disallow the usage of "only", "failing", "todo", "skipped" modifiers
  --globals               Allow for tests to create global variables
  --random [seed]         Randomize your tests. Optionally specify a seed or one will be generated
  --snapshot-dir          Specify a fixed location for storing the snapshot files
  --env <environment>     The test environment used for all tests. This can point to any file or node module
  --reporter <name>       Specify the reporter to use; if no match is found a list of available reporters will be displayed
  --no-timeouts           Disable timeouts. Given implicitly with --debug
  --no-color              Disable color output
  --no-diff               Disable the showing of a diff on failure
  --no-stack              Disable the showing of a strack trace on failure
  --no-code-frame         Disable the showing of a code frame
  --inspect               Same as --inspect on nodejs. Forces concurrency 1
  --inspect-brk           Same as --inspect-brk on nodejs. Forces concurrency 1
  --debug                 Same as --inspect-brk=0 on nodejs. Can be used with any concurrency value
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
    slow: {
      type: "number"
    },
    allowNoPlan: {
      type: "boolean",
      default: false
    },
    strict: {
      type: "boolean",
      default: false
    },
    globals: {
      type: "boolean",
      default: false
    },
    snapshotDir: {
      type: "string"
    },
    reporter: {
      type: "string"
    },
    color: {
      type: "boolean",
      default: true
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
    }
  }
} );
