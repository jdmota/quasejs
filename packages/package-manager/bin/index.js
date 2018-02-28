#!/usr/bin/env node

const help = `
Usage
  $ qpm <command> [options]

Commands

  install        Installs all the dependencies in the package.json using the lockfile to resolve if available.

  upgrade        Upgrades all the dependencies in the package.json.

  init           Fills the folder with some predefined files.

  normalize-pkg  Normalize package.json file.

  check          Verifies that versions of the dependencies in the package.json file match the lockfile.

`;

// TODO

require( "@quase/cli" ).default( {
  help,
  schema: {
    folder: {
      type: "string"
    }
  }
} ).then( ( { input, options } ) => {
  require( "../dist/cli" ).run( input, options );
} );
