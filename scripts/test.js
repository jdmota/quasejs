//@ts-check
import { spawn } from "node:child_process";

let args = process.argv.slice(2);
let pkg;

if (args.length > 0 && !args[0].startsWith("-")) {
  pkg = args[0];
  args = args.slice(1);
}

const debug = args.includes("--debug");
if (debug) args = args.filter(a => a !== "--debug");

spawn(
  "node",
  [
    "--experimental-vm-modules",
    "--no-warnings=ExperimentalWarning",
    debug ? "--inspect-brk" : "",
    "./node_modules/jest/bin/jest.js",
    debug ? "--runInBand" : "",
    pkg ? `--roots=packages/${pkg}` : "",
    ...args,
  ].filter(Boolean),
  {
    stdio: "inherit",
  }
);
