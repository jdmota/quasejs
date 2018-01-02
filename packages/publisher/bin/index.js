#!/usr/bin/env node
/* eslint-disable no-console */

const help = `
Usage
  $ quase-publisher [version] [options]

Options
  --no-cleanup
`;

// TODO

require( "@quase/cli" ).default( ( { input, options } ) => {
  options.version = input[ 0 ];
  require( "../dist" ).default( options );
}, {
  help,
  inferType: true,
  defaultConfigFile: "quase-publisher-config.js",
  configKey: "quase-publisher",
  flags: {
    cleanup: {
      type: "boolean",
      default: true
    }
  }
} );
