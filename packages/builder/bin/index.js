#!/usr/bin/env node
/* eslint-disable no-console */

const help = `
Usage
  $ quase-builder [options]

Options
  --watch, -w    Watch files for changes and re-build
`;

require( "@quase/cli" ).default( ( { options } ) => {
  require( "../dist" ).default( options );
}, {
  help,
  configFiles: "quase-builder-config.js",
  configKey: "quase-builder",
  schema: {
    watch: {
      type: "boolean",
      alias: "w",
      default: false
    }
  }
} );
