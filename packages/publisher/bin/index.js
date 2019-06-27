#!/usr/bin/env node
const { cli } = require( "@quase/cli" );

const schema = `
type GitOptions {
  branch: string @default("master") @description("");
  check: boolean @default(true) @description("");
  commitAndTag: boolean | "only-commit" @default(true) @description("");
  push: boolean @default(true) @description("");
  message: string? @description("");
  tagPrefix: string? @description("");
  signCommit: boolean @default(false) @description("");
  signTag: boolean @default(false) @description("");
  commitHooks: boolean @default(true) @description("");
  pushHooks: boolean @default(true) @description("");
}
type Schema {
  preview: boolean @default(false) @description("");
  publish: boolean @default(true) @description("'false' to skip publishing");
  version: string? @description("Version to publish");
  tag: string? @description("Publish under a given dist-tag");
  access: string? @description("");
  contents: string? @description("Subdirectory (relative to --folder) to publish") @example("dist");
  yarn: boolean? @description("Use Yarn");
  git: boolean | GitOptions @default(true) @description("");
  cwd: string @default(js(process.cwd())) @description("");
  folder: string @default(js(process.cwd())) @description("");
  tasks: type @additionalProperties {};
}`;

let history;

cli( {
  usage: "$ quase-publisher <version> [options]",
  configFiles: "quase-publisher.config.js",
  configKey: "quase-publisher",
  schema
} ).then( ( { input, options } ) => {
  options.version = options.version || input[ 0 ];
  require( ".." ).default( options, h => ( history = h ) );
} );

/* eslint-disable no-process-exit, no-console */

process.on( "SIGINT", () => {
  console.log( "\nAborted!" );
  if ( history ) {
    history.show();
  }
  process.exit( 1 );
} );
