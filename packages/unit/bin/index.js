#!/usr/bin/env node

const usage = `
  $ quase-unit [<files|globs>...] [options]

  If you provide files or globs, you override the "files" configuration.`;

require( "@quase/cli" ).default( {
  usage,
  configFiles: "quase-unit-config.js",
  configKey: "quase-unit",
  schema: ( { t } ) => ( {
    files: t.array( {
      itemType: "string",
      optional: true,
    } ),
    match: t.union( {
      types: [ "string", t.array( { itemType: "string" } ) ],
      alias: "m",
      optional: true,
      description: "Only run tests with matching title (Can be repeated)"
    } ),
    watch: {
      type: "boolean",
      alias: "w",
      default: false,
      description: "Watch files for changes and re-run the related tests"
    },
    bail: {
      type: "boolean",
      default: false,
      description: "Stop after first test failure"
    },
    forceSerial: {
      type: "boolean",
      default: false,
      description: "Run tests serially. It forces --concurrency=1"
    },
    concurrency: {
      type: "number",
      alias: "c",
      optional: true,
      description: "Max number of test files running at the same time (Default: CPU logical cores or 2 if running in CI)"
    },
    updateSnapshots: {
      type: "boolean",
      alias: "u",
      default: false,
      description: "Update snapshots"
    },
    globals: t.union( {
      types: [ "boolean", t.array( { itemType: "string" } ) ],
      default: false,
      description: "Specify which global variables can be created by the tests. 'true' for any. Default is 'false'."
    } ),
    random: t.union( {
      types: [ "boolean", "string" ],
      optional: true,
      description: "Randomize your tests. Optionally specify a seed or one will be generated"
    } ),
    timeout: {
      type: "number",
      alias: "t",
      optional: true,
      description: "Set test timeout"
    },
    slow: {
      type: "number",
      optional: true,
      description: "Set 'slow' test threshold"
    },
    only: {
      type: "boolean",
      default: false,
      description: "Only run tests marked with '.only' modifier"
    },
    strict: {
      type: "boolean",
      default: false,
      description: "Disallow the usage of 'only', 'failing', 'todo', 'skipped' modifiers"
    },
    allowNoPlan: {
      type: "boolean",
      default: false,
      description: "Make tests still succeed if no assertions are run and no planning was done"
    },
    snapshotLocation: t.union( {
      types: [ "string", "function" ],
      optional: true,
      description: "Specify a fixed location for storing the snapshot files"
    } ),
    reporter: t.union( {
      types: [ "string", "function" ],
      optional: true,
      description: "Specify the reporter to use; if no match is found a list of available reporters will be displayed"
    } ),
    env: t.union( {
      types: [ "string", "object" ],
      optional: true,
      description: "The test environment used for all tests. This can point to any file or node module"
    } ),
    diff: {
      type: "boolean",
      default: true,
      description: "Enable/disable diff on failure"
    },
    stack: {
      type: "boolean",
      default: true,
      description: "Enable/disable strack trace on failure"
    },
    stackIgnore: {
      type: "regexp",
      map( x ) {
        return typeof x === "string" ? new RegExp( x ) : x;
      },
      optional: true,
      description: "Regular expression to ignore some stacktrace files"
    },
    codeFrame: {
      type: "boolean",
      default: true,
      description: "Enable/disable code frame"
    },
    color: {
      type: "boolean",
      optional: true,
      description: "Force or disable. Default: auto detection"
    },
    timeouts: {
      type: "boolean",
      default: true,
      description: "Enable/disable timeouts. Disabled by default with --debug"
    },
    verbose: {
      type: "boolean",
      default: false,
      description: "Enable verbose output"
    },
    inspect: {
      type: "boolean",
      default: false,
      description: "Same as --inspect on nodejs. Forces concurrency 1"
    },
    inspectBrk: {
      type: "boolean",
      default: false,
      description: "Same as --inspect-brk on nodejs. Forces concurrency 1"
    },
    debug: {
      type: "boolean",
      default: false,
      description: "Same as --inspect-brk=0 on nodejs. Can be used with any concurrency value"
    },
    logHeapUsage: {
      type: "boolean",
      default: false,
      description: "Logs the heap usage after every test. Useful to debug memory leaks."
    }
  } )
} ).then( o => {
  require( "../dist/cli" ).default( o );
} );
