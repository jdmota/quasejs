#!/usr/bin/env node

const { cli, t } = require( "@quase/cli" );

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
  frozenLockfile: {
    type: "boolean",
    description: "Don't generate a lockfile and fail if an update is needed."
  }
};

const addRemoveSchema = {
  type: t.choices( {
    values: [ "prod", "dev", "optional" ],
    optional: true
  } )
};

function spread( a, b ) {
  return Object.assign( {}, a, b );
}

cli( {
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
    add: {
      description: "Add and install one or more packages.",
      schema: spread( installSchema, addRemoveSchema )
    },
    remove: {
      description: "Remove and uninstall one or more packages.",
      schema: spread( installSchema, addRemoveSchema )
    },
    normalizePkg: {
      description: "Normalize package.json file.",
      schema: {
        folder: installSchema.folder
      }
    },
    check: {
      description: "Validates package.json and checks consistency between it and the lockfile.",
      schema: {
        folder: installSchema.folder
      }
    }
  }
} ).then( ( { command, options, input } ) => {
  require( ".." ).run( command, options, input );
} );
