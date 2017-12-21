#!/usr/bin/env node
/* eslint-disable no-console */

const help = `
Usage
  $ quase-builder [options]

Options
  --watch, -w    Watch files for changes and re-build
`;

require( "@quase/cli" ).default( ( { flags, config } ) => {
  const p = require( "../dist" ).default( Object.assign( {}, config, flags ) );
  if ( p.then ) {
    p.then( o => console.log( o ) );
  }
}, {
  help,
  inferType: true,
  defaultConfigFile: "quase-builder-config.js",
  configKey: "quase-builder",
  flags: {
    watch: {
      type: "boolean",
      alias: "w"
    }
  }
} );
