const path = require("path");
const Module = require("module");

require("./register");

process.env.NODE_OPTIONS = process.env.NODE_OPTIONS || "";
process.env.NODE_OPTIONS += ` -r ${path.resolve(__dirname, "register.js")}`;

// Adapted from from @babel/node

const args = process.argv.slice(2);

// Make the filename absolute
const filename = args[0];
if (!path.isAbsolute(filename)) {
  args[0] = path.join(process.cwd(), filename);
}

// Add back on node and concat the sliced args
process.argv = ["node"].concat(args);
process.execArgv.unshift(__filename);

Module.runMain();
