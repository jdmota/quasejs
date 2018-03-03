#!/usr/bin/env node

const installSchema = {
  folder: {
    type: "string",
    description: "Folder in which package.json is present",
    optional: true
  },
  store: {
    type: "string",
    description: "",
    optional: true
  },
  cache: {
    type: "string",
    description: "",
    optional: true
  },
  offline: {
    type: "boolean",
    description: "",
    optional: true
  },
  preferOffline: {
    type: "boolean",
    description: "",
    optional: true
  },
  preferOnline: {
    type: "boolean",
    description: "",
    optional: true
  },
  flat: {
    type: "boolean",
    description: "",
    optional: true
  },
  cliTest: {
    type: "boolean",
    optional: true
  }
};

require( "@quase/cli" ).default( {
  usage: "$ qpm <command> [options]",
  defaultCommand: "install",
  commands: {
    install: {
      description: "Installs all the dependencies in the package.json using the lockfile to resolve if available.",
      schema: installSchema
    },
    upgrade: {
      description: "Upgrades all the dependencies in the package.json.",
      schema: installSchema
    },
    normalizePkg: {
      description: "Normalize package.json file.",
      schema: {
        folder: installSchema.folder
      }
    },
    check: {
      description: "Verifies that versions of the dependencies in the package.json file match the lockfile.",
      schema: {
        folder: installSchema.folder
      }
    }
  }
} ).then( ( { command, options } ) => {
  require( "../dist/cli" ).run( command, options );
} );
