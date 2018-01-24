#!/usr/bin/env node

require( "@quase/cli" ).default( ( { options } ) => {
  require( "../dist" ).default( options );
}, {
  usage: "$ quase-builder [options]",
  configFiles: "quase-builder-config.js",
  configKey: "quase-builder",
  schema: {
    watch: {
      type: "boolean",
      alias: "w",
      description: "Watch files for changes and re-build"
    }
  }
} );
