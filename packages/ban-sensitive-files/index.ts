import path from "path";
import type { Options } from "./types";
import { checkFile } from "./check-file";
import { collectFiles } from "./collect-files";
import { never } from "../util/miscellaneous";
import { prettifyPath } from "../util/path-url";

function msg(number: number, string: string): string {
  return string
    .replace(/%d/g, number + "")
    .replace(/%s/g, number === 1 ? "" : "s");
}

// Heavily inspired on https://github.com/bahmutov/ban-sensitive-files
export async function bin(partialOptions: Partial<Options> = {}) {
  console.log("Searching for sensitive data...");

  const options: Options = {
    folder: process.cwd(),
    all: true,
    verbose: true,
    ...partialOptions,
  };

  console.log("Options", options);
  console.log();

  let banned = 0;
  let sensitive = 0;

  for await (const report of run(options)) {
    switch (report.kind) {
      case "ok":
        break;
      case "banned": {
        banned++;
        console.error(`  BANNED ${prettifyPath(report.filename)}`);
        if (options.verbose) {
          if (report.rule.caption) {
            console.error(`    ${report.rule.caption}`);
          }
          if (report.rule.description) {
            console.error(`      ${report.rule.description}`);
          }
        }
        break;
      }
      case "sensitive": {
        sensitive++;
        console.error(`  SENSITIVE ${prettifyPath(report.filename)}`);
        if (options.verbose) {
          if (report.rule.caption) {
            console.error(`    ${report.rule.caption}`);
          }
          if (report.rule.description) {
            console.error(`      ${report.rule.description}`);
          }
          console.error(`      Pattern: ${report.check.pattern}`);
        }
        break;
      }
      default:
        never(report);
    }
  }

  const error = banned > 0 || sensitive > 0;
  if (error) {
    console.error(msg(banned + sensitive, `\n%d sensitive file%s found.`));
    process.exitCode = 1;
  } else {
    console.log("All ok!");
  }
  return error;
}

export async function* run(
  options: Options,
  providedFilenames?: readonly string[]
) {
  const filenames = providedFilenames
    ? providedFilenames.map(f => path.resolve(options.folder, f))
    : collectFiles(options);
  for await (const file of filenames) {
    yield checkFile(file);
  }
}
