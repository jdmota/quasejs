#!/usr/bin/env node

const { cli, quaseConfig: { t, extractDefaults } } = require( "@quase/cli" );

const boolOrFn = description => t.union( {
  types: [ "boolean", "function" ],
  default: true,
  description: description || ""
} );

const gitConfig = t.object( {
  properties: {
    branch: {
      type: "string",
      default: "master",
      description: ""
    },
    commitAndTag: {
      type: "boolean",
      default: true,
      description: ""
    },
    message: {
      type: "string",
      optional: true,
      description: ""
    },
    tagPrefix: {
      type: "string",
      optional: true,
      description: ""
    },
    signCommit: {
      type: "boolean",
      default: false,
      description: ""
    },
    signTag: {
      type: "boolean",
      default: false,
      description: ""
    },
    commitHooks: {
      type: "boolean",
      default: true,
      description: ""
    },
    pushHooks: {
      type: "boolean",
      default: true,
      description: ""
    }
  }
} );

const gitConfigDefaults = extractDefaults( gitConfig );

const schema = {
  preview: {
    type: "boolean",
    description: ""
  },
  cwd: {
    type: "string",
    default: process.cwd(),
  },
  folder: {
    type: "string",
    default: process.cwd(),
    description: ""
  },
  tag: {
    type: "string",
    optional: true,
    description: "Publish under a given dist-tag"
  },
  access: {
    type: "string",
    optional: true,
    description: ""
  },
  contents: {
    type: "string",
    optional: true,
    description: "Subdirectory (relative to --folder) to publish",
    example: "dist"
  },
  yarn: {
    type: "boolean",
    default: false,
    description: "Use Yarn"
  },
  git: t.union( {
    types: [ "boolean", gitConfig ],
    map: x => ( x === true ? gitConfigDefaults : x ),
    default: gitConfigDefaults,
    description: "Git related options"
  } ),
  checkDeps: boolOrFn(),
  checkSensitiveData: boolOrFn(),
  preCheck: boolOrFn(),
  gitCheck: boolOrFn(),
  cleanup: boolOrFn( "Cleanup of node_modules" ),
  build: {
    type: "function",
    optional: true
  },
  test: boolOrFn(),
  rootBeforeVersion: boolOrFn(),
  bumpVersion: boolOrFn(),
  changelog: {
    type: "function",
    optional: true
  },
  commitAndTag: boolOrFn(),
  rootAfterVersion: boolOrFn(),
  rootBeforePublish: boolOrFn(),
  publish: boolOrFn(),
  rootAfterPublish: boolOrFn(),
  gitPush: boolOrFn()
};

cli( {
  usage: "$ quase-publisher <version> [options]",
  configFiles: "quase-publisher.config.js",
  configKey: "quase-publisher",
  schema
} ).then( ( { input, options } ) => {
  options.version = input[ 0 ];
  require( ".." ).default( options );
} );

/* eslint-disable no-process-exit, no-console */

process.on( "SIGINT", () => {
  console.log( "\nAborted!" );
  process.exit( 1 );
} );
