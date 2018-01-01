#!/usr/bin/env node
/* eslint-disable no-console */

const help = `
Usage
  $ quase-publisher [version] [options]

Options
  --no-cleanup
`;

require( "@quase/cli" ).default( ( { input, flags, config } ) => {
  const opts = Object.assign( {}, config, flags );
  opts.version = input[ 0 ];
  require( "../dist" ).default( opts );
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
