#!/usr/bin/env node

const { cli } = require("@quase/cli");

const usage = `
  $ quase-unit [<files|globs>...] [options]

  If you provide files or globs, you override the "files" configuration.`;

const unitCli = require("../dist/cli");

cli({
  usage,
  configFiles: "quase-unit.config.js",
  configKey: "quase-unit",
  schema: unitCli.schema,
}).then(o => unitCli.default(o));
