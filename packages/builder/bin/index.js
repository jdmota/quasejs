#!/usr/bin/env node

const schema = require( "../dist/options" ).schema;

require( "@quase/cli" ).default( {
  usage: "$ quase-builder [options]",
  configFiles: "quase-builder-config.js",
  configKey: "quase-builder",
  schema
} ).then( ( { options } ) => {
  require( "../dist" ).default( options );
} );
