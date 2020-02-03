#!/usr/bin/env node

const { default: start, schema, handleOptions } = require("..");

require("@quase/cli")
  .cli({
    usage: "$ quase-builder [options]",
    configFiles: "quase-builder.config.js",
    configKey: "quase-builder",
    schema,
  })
  .then(({ options }) => {
    start(handleOptions(options));
  });
