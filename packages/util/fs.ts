import fs from "fs/promises";

// https://nodejs.org/api/errors.html#nodejs-error-codes

// "No such file or directory"
export function isNoFileError(error: any) {
  return error != null && error.code === "ENOENT";
}

export async function readFileString(filename: string): Promise<string> {
  try {
    return await fs.readFile(filename, "utf8");
  } catch (error) {
    if (isNoFileError(error)) {
      return "";
    }
    throw error;
  }
}
