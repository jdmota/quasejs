#!/usr/bin/env node

const help = `
Usage
  $ qpm <command> [options]

Commands

  install        Installs all the dependencies in the package.json using the lockfile to resolve if available.

  upgrade        Upgrades all the dependencies in the package.json.

  normalize-pkg  Normalize package.json file.

  check          Verifies that versions of the dependencies in the package.json file match the lockfile.

`;

require( "@quase/cli" ).default( ( { input, flags } ) => {
  require( "../dist/cli" ).run( input, flags );
}, {
  help,
  inferType: true,
  flags: {}
} );
