#!/usr/bin/env node

const { default: start, schema } = require( ".." );

require( "@quase/cli" ).default( {
  usage: "$ quase-builder [options]",
  configFiles: "quase-builder-config.js",
  configKey: "quase-builder",
  schema
} ).then( ( { options } ) => {
  start( options );
} );
