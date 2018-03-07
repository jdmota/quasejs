#!/usr/bin/env node

require( "@quase/cli" ).default( {
  usage: "$ quase-publisher <version> [options]",
  configFiles: "quase-publisher.config.js",
  configKey: "quase-publisher",
  schema( t ) {
    const boolOrFn = t.union( [ "boolean", "function" ] );
    const gitConfig = t.object( {
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
    } );

    const gitConfigDefaults = gitConfig.defaults();

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
      git: {
        type: t.union( [ "boolean", gitConfig ] ),
        map: x => ( x === true ? gitConfigDefaults : x ),
        default: gitConfigDefaults,
        description: "Git related options"
      },
      checkDeps: {
        type: boolOrFn,
        default: true,
        description: ""
      },
      checkSensitiveData: {
        type: boolOrFn,
        default: true,
        description: ""
      },
      preCheck: {
        type: boolOrFn,
        default: true,
        description: ""
      },
      gitCheck: {
        type: boolOrFn,
        default: true,
        description: ""
      },
      cleanup: {
        type: boolOrFn,
        default: true,
        description: "Cleanup of node_modules"
      },
      build: {
        type: boolOrFn,
        default: true,
        description: ""
      },
      test: {
        type: boolOrFn,
        default: true,
        description: ""
      },
      rootBeforeVersion: {
        type: boolOrFn,
        default: true,
        description: ""
      },
      bumpVersion: {
        type: boolOrFn,
        default: true,
        description: ""
      },
      commitAndTag: {
        type: boolOrFn,
        default: true,
        description: ""
      },
      rootAfterVersion: {
        type: boolOrFn,
        default: true,
        description: ""
      },
      rootBeforePublish: {
        type: boolOrFn,
        default: true,
        description: ""
      },
      publish: {
        type: boolOrFn,
        default: true,
        description: ""
      },
      rootAfterPublish: {
        type: boolOrFn,
        default: true,
        description: ""
      },
      gitPush: {
        type: boolOrFn,
        default: true,
        description: ""
      }
    };
  }
} ).then( ( { input, options } ) => {
  options.version = input[ 0 ];
  require( ".." ).default( options );
} );
