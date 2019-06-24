import { getOnePlugin } from "@quase/get-plugins";
import turbocolor from "turbocolor";
import isCi from "is-ci";
import os from "os";
import NodeReporter from "../reporters/node";
import { assertTimeout } from "./util/assert-args";
import { color as colorConcordanceOptions, plain as plainConcordanceOptions } from "./concordance-options";
import randomizerFn from "./random";
import { validationError } from "../node-runner/util";
import { CliOptions, NormalizedOptions } from "../types";

function arrify<T>( val: T | T[] | undefined ): T[] {
  if ( val == null ) {
    return [];
  }
  return Array.isArray( val ) ? val : [ val ];
}

const schemaCompiler = require( "@quase/schema/dist/compiler" ).default;

export const schema = `
type B @default(false) = boolean;
type B2 @default(true) = boolean;

type Schema {
  files: string[] @mergeStrategy("override") @description("Glob patterns of files to include");
  ignore: string[] @mergeStrategy("concat") @description("Glob patterns of files to ignore");
  match: ( string | string[] )? @alias("m") @description("Only run tests with matching title (Can be repeated)");
  watch: B @alias("w") @description("Watch files for changes and re-run the related tests");
  bail: B @description("Stop after first test failure");
  forceSerial: B @description("Run tests serially. It forces --concurrency=1");
  concurrency: number? @alias("c") @description("Max number of test files running at the same time (Default: CPU logical cores or 2 if running in CI)");
  updateSnapshots: B @alias("u") @description("Update snapshots");
  globals: ( boolean | string[] )? @description("Specify which global variables can be created by the tests. 'true' for any. Default is 'false'.");
  random: ( boolean | string ) @default(false) @description("Randomize your tests. Optionally specify a seed or one will be generated");
  timeout: number @default(0) @alias("t") @description("Set test timeout");
  slow: number @default(0) @description("Set 'slow' test threshold");
  only: B @description("Only run tests marked with '.only' modifier");
  strict: B @description("Disallow the usage of 'only', 'failing', 'todo', 'skipped' modifiers");
  allowNoPlan: B @description("Make tests still succeed if no assertions are run and no planning was done");
  snapshotLocation: ( string | Function )? @description("Specify a fixed location for storing the snapshot files");
  reporter: string? @description("Specify the reporter to use");
  env: ( string | Object )? @description("The test environment used for all tests. This can point to any file or node module");
  diff: B2 @description("Enable/disable diff on failure");
  stack: B2 @description("Enable/disable stack trace on failure");
  codeFrame: B2 @description("Enable/disable code frame");
  codeFrameOptions: Object? @description("Code frame options");
  stackIgnore: ( string | RegExp )? @description("Regular expression to ignore some stacktrace files");
  color: boolean | "auto" @default("auto") @description("Force or disable. Default: auto detection");
  timeouts: B2 @description("Enable/disable test timeouts. Disabled by default with --debug");
  globalTimeout: number @default(20000) @description("Global timeout. Zero to disable. Disabled by default with --debug");
  verbose: B @description("Enable verbose output");
  debug: B @description("Same as --inspect-brk=0 on nodejs.");
  logHeapUsage: B @description("Logs the heap usage after every test. Useful to debug memory leaks.");
  concordanceOptions: Object? @description("Concordance options.");
}
`;

const compiledSchema = eval( schemaCompiler( schema ) ); // eslint-disable-line no-eval

export function cliValidate( opts: any ): CliOptions {
  return compiledSchema.validateAndMerge( {}, opts );
}

export default function(
  options: CliOptions,
  slashSlash?: string[] | undefined,
  configLocation?: string | undefined
): NormalizedOptions {
  if ( options.forceSerial ) {
    if ( options.concurrency != null && options.concurrency !== 1 ) {
      throw validationError( `You cannot use "concurrency" with --force-serial` );
    }
  }

  let concurrency = options.concurrency && options.concurrency > 0 ? options.concurrency : Math.min( os.cpus().length, isCi ? 2 : Infinity );
  let color = options.color === undefined ? turbocolor.enabled : !!options.color;

  if ( options.forceSerial ) {
    concurrency = 1;
  }

  const randomizer = options.random ? randomizerFn( options.random ) : null;
  const random = randomizer ? randomizer.hex : undefined;
  let timeouts = options.timeouts;
  let globalTimeout = options.globalTimeout;

  if ( options.debug ) {
    timeouts = false;
    globalTimeout = 0;
  } else if ( globalTimeout != null ) {
    assertTimeout( globalTimeout, "global timeout" );
  }

  assertTimeout( options.timeout );

  let stackIgnore;
  if ( typeof options.stackIgnore === "string" ) {
    stackIgnore = new RegExp( options.stackIgnore );
  }

  const reporter = options.reporter ? getOnePlugin( options.reporter ).plugin : NodeReporter;

  if ( typeof reporter !== "function" ) {
    throw validationError( `Reporter should be a constructor` );
  }

  const env = options.env ? getOnePlugin( options.env ).plugin : {};

  if ( env == null || typeof env !== "object" ) {
    throw validationError( `Environment variables should be an object` );
  }

  const concordanceOptions = options.concordanceOptions ?
    getOnePlugin( options.concordanceOptions ).plugin :
    ( options.color ? colorConcordanceOptions : plainConcordanceOptions );

  if ( concordanceOptions == null || typeof concordanceOptions !== "object" ) {
    throw validationError( `Concordance options should be an object` );
  }

  const files = arrify( options.files );
  const match = arrify( options.match );
  const globals = arrify<boolean | string>( options.globals );

  return {
    ...options,
    "--": arrify( slashSlash ),
    configLocation,
    files,
    match,
    concurrency,
    color,
    random,
    timeouts,
    stackIgnore,
    globals,
    reporter,
    env,
    concordanceOptions
  };
}
