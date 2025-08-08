import { dirname, parse, resolve } from "node:path";
import process from "node:process";
import { lstat, stat, readFile } from "node:fs/promises";
import type { MaybeAsync, Optional } from "./miscellaneous";

// https://nodejs.org/api/errors.html#nodejs-error-codes

// "No such file or directory"
export function isNoFileError(error: any) {
  return error != null && error.code === "ENOENT";
}

export async function readFileString(filename: string): Promise<string> {
  try {
    return await readFile(filename, "utf8");
  } catch (error) {
    if (isNoFileError(error)) {
      return "";
    }
    throw error;
  }
}

export async function isFile(path: string, allowSymlinks: boolean) {
  try {
    return (await (allowSymlinks ? stat : lstat)(path)).isFile();
  } catch {
    return false;
  }
}

// Based on https://github.com/antfu-collective/unconfig/blob/main/src/fs.ts

export type FindUpCustomOptions = Readonly<{
  /**
   * @default process.cwd
   */
  cwd?: string;
  /**
   * @default path.parse(cwd).root
   */
  stopAt?: string;
  /**
   * @default false
   */
  multipleAtLevel?: boolean;
  /**
   * @default false
   */
  multipleUp?: boolean;
}>;

export async function findUpCustom<T>(
  paths: readonly string[],
  options: FindUpCustomOptions,
  job: (filename: string) => MaybeAsync<Optional<T>>
): Promise<readonly T[]> {
  const { multipleAtLevel = false, multipleUp = false } = options;
  const cwd = options.cwd ? resolve(options.cwd) : process.cwd();
  const stopAt = options.stopAt ? resolve(options.stopAt) : parse(cwd).root;

  let currDir = cwd;
  const results: T[] = [];

  while (currDir) {
    inner: for (const path of paths) {
      const filepath = resolve(currDir, path);
      const result = await job(filepath);
      if (result != null) {
        results.push(result);
        if (!multipleAtLevel) break inner;
      }
    }
    if (results.length > 0 && !multipleUp) break;
    if (currDir === stopAt) break;
    const parent = dirname(currDir);
    if (parent === currDir) break;
    currDir = parent;
  }

  return results;
}

export type FindUpOptions = FindUpCustomOptions &
  Readonly<{
    /**
     * @default true
     */
    allowSymlinks?: boolean;
  }>;

export async function findUp(
  paths: readonly string[],
  options: FindUpOptions = {}
): Promise<readonly string[]> {
  const allowSymlinks = options.allowSymlinks ?? true;
  return findUpCustom(paths, options, async filename => {
    if (await isFile(filename, allowSymlinks)) {
      return filename;
    }
  });
}
