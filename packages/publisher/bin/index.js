#!/usr/bin/env node

require( "@quase/cli" ).default( {
  usage: "$ quase-publisher <version> [options]",
  configFiles: "quase-publisher.config.js",
  configKey: "quase-publisher",
  schema( t ) {
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

    const gitConfigDefaults = gitConfig.defaults( [], {} );

    return {
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
      build: boolOrFn(),
      test: boolOrFn(),
      rootBeforeVersion: boolOrFn(),
      bumpVersion: boolOrFn(),
      commitAndTag: boolOrFn(),
      rootAfterVersion: boolOrFn(),
      rootBeforePublish: boolOrFn(),
      publish: boolOrFn(),
      rootAfterPublish: boolOrFn(),
      gitPush: boolOrFn()
    };
  }
} ).then( ( { input, options } ) => {
  options.version = input[ 0 ];
  require( ".." ).default( options );
} );

/* eslint-disable no-process-exit, no-console */

process.on( "SIGINT", () => {
  console.log( "\nAborted!" );
  process.exit( 1 );
} );
