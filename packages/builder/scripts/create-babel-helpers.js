const path = require("path");
const fs = require("fs-extra");
const { buildExternalHelpers } = require("@babel/core");

/* eslint no-console: 0 */

const babelExternalsFile = path.join(
  __dirname,
  "../src/plugins/transformers/babel-helpers.js"
);
const babelExternalsCode = buildExternalHelpers(null, "module");
fs.writeFileSync(babelExternalsFile, babelExternalsCode);

console.log(babelExternalsFile);
