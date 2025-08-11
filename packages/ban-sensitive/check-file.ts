import type { FileReport } from "./types";
import { banCheckers, contentCheckers } from "./rules";
import { readFileString } from "../util/fs";

export async function checkFile(filename: string): Promise<FileReport> {
  filename = filename.toLowerCase();

  for (const { rule, test } of banCheckers) {
    if (test(filename)) {
      return {
        kind: "banned",
        filename,
        rule,
      };
    }
  }

  let text = null;
  for (const { rule, test, checks } of contentCheckers) {
    if (test(filename)) {
      text ??= (await readFileString(filename)).toLowerCase();
      for (const { check, test } of checks) {
        if (test(text)) {
          text = "";
          return {
            kind: "sensitive",
            filename,
            rule,
            check,
          };
        }
      }
    }
  }

  return {
    kind: "ok",
    filename,
  };
}
