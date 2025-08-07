import path from "path";
import { readFileString } from "../util/fs";
import nameToCheck from "./sensitive-files";

export async function checkSensitiveFile(
  filename: string
): Promise<readonly string[]> {
  const check = nameToCheck[path.basename(filename)];
  if (check) {
    let text = await readFileString(filename);
    const errors = await check(filename, text);
    text = ""; // Just in case
    if (errors.length > 0) {
      return errors;
    }
  }
  return [];
}
