const fs = require("fs-extra");
const path = require("path");
const execa = require("execa");

/* eslint no-console: 0 */
/* eslint no-process-exit: 0 */

const pkg = process.argv.slice(2)[0];

if (!pkg || typeof pkg !== "string") {
  console.error(pkg + " is not valid");
  process.exit(1);
}

const src = path.join("packages", pkg, "src").replace(/\\+/g, "/");
const dist = path.join("packages", pkg, "dist").replace(/\\+/g, "/");

console.log(`Running build in ${pkg}...`);

const babelArgs = [
  src,
  "--out-dir",
  dist,
  "--copy-files",
  "--extensions",
  ".js,.ts",
];

fs.emptyDir(dist)
  .then(() =>
    execa("babel", babelArgs, {
      stdio: "inherit",
    })
  )
  .catch(() => {
    process.exitCode = 1;
  });
