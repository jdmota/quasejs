import path from "path";
import type { FileReport, Options } from "./types";
import { isBanned } from "./is-banned";
import { collectFiles } from "./collect-files";
import { checkSensitiveFile } from "./check-sensitive-files";
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
          for (const rule of report.rules) {
            if (rule.caption) {
              console.error(`    ${rule.caption}`);
            }
            if (rule.description) {
              console.error(`      ${rule.description}`);
            }
          }
        }
        break;
      }
      case "sensitive": {
        sensitive++;
        console.error(`  SENSITIVE ${prettifyPath(report.filename)}`);
        if (options.verbose) {
          for (const error of report.errors) {
            console.error(`    ${error}`);
          }
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

async function runForFile(file: string): Promise<FileReport> {
  const banned = isBanned(file);
  if (banned.length > 0) {
    return {
      kind: "banned",
      filename: file,
      rules: banned,
    };
  }
  const sensitive = await checkSensitiveFile(file);
  if (sensitive.length > 0) {
    return {
      kind: "sensitive",
      filename: file,
      errors: sensitive,
    };
  }
  return { kind: "ok", filename: file };
}

export async function* run(
  options: Options,
  providedFilenames?: readonly string[]
) {
  const filenames = providedFilenames
    ? providedFilenames.map(f => path.resolve(options.folder, f))
    : collectFiles(options);
  for await (const file of filenames) {
    yield runForFile(file);
  }
}
