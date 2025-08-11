//@ts-check
import { lstat } from "node:fs/promises";
import { spawn } from "node:child_process";

/**
 * @param {string} path
 */
async function isFile(path) {
  try {
    return (await lstat(path)).isFile();
  } catch {
    return false;
  }
}

const [pkg, ...rest] = process.argv.slice(2);
let ok = false;

for (const file of [`./packages/${pkg}/index.ts`, `./packages/${pkg}.ts`]) {
  if (await isFile(file)) {
    spawn(
      "node",
      [
        "--enable-source-maps",
        "--import",
        "@swc-node/register/esm-register",
        file,
        ...rest,
      ],
      {
        stdio: "inherit",
      }
    );
    ok = true;
    break;
  }
}

if (!ok) {
  throw new Error(`Not found: ${pkg}`);
}
