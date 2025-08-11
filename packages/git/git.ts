import path from "path";
import { GitProcess, GitError, type IGitResult } from "dugite";

function getLines(original: string): string[] {
  const string = original.replace(/\n$/, "");
  if (string === "") return [];
  return string.split("\n");
}

function handleGitError(result: IGitResult): never {
  throw new Error(
    `Git error: ${GitProcess.parseError(result.stderr) ?? result.stderr}`
  );
}

export async function getDotGitDir(folder: string): Promise<string | null> {
  // Get the path to the .git folder
  const result = await GitProcess.exec(["rev-parse", "--git-dir"], folder);
  if (result.exitCode === 0) {
    return path.resolve(folder, result.stdout.trim());
  }
  const error = GitProcess.parseError(result.stderr);
  if (error === GitError.NotAGitRepository) {
    return null;
  }
  return handleGitError(result);
}

export type GitLsOpts = Readonly<{
  showDeleted: boolean;
  showModified: boolean;
  showOthers: boolean;
}>;

export async function gitLs(
  folder: string,
  opts: Partial<GitLsOpts> = {}
): Promise<readonly string[]> {
  const result = await GitProcess.exec(
    [
      "ls-files",
      "--full-name",
      opts.showDeleted ? "--deleted" : "",
      opts.showModified ? "--modified" : "",
      opts.showOthers ? "--others" : "",
    ].filter(Boolean),
    folder
  );
  if (result.exitCode === 0) {
    return getLines(result.stdout);
  }
  return handleGitError(result);
}

// https://git-scm.com/docs/git-status#_short_format
export enum GitStatusChar {
  UNMODIFIED = "",
  MODIFIED = "M",
  FILE_TYPE_CHANGED = "T",
  ADDED = "A",
  DELETED = "D",
  RENAMED = "R",
  COPIED = "C",
  UPDATED = "U",
}

export type GitStatusShortFormat = Readonly<{
  x: GitStatusChar;
  y: GitStatusChar;
  origPath: string | null;
  path: string;
}>;

const reGitShortFormat = /^(.)(.) ([^]+)?$/;

// https://git-scm.com/docs/git-status#_short_format
export function parseGitStatusShortFormat(line: string): GitStatusShortFormat {
  // XY PATH
  // XY ORIG_PATH -> PATH
  const match = line.match(reGitShortFormat);
  if (!match) throw new Error(`Invalid: ${JSON.stringify(line)}`);
  const x = match[1].trim() as GitStatusChar;
  const y = match[2].trim() as GitStatusChar;
  const parts = match[3].split(" -> ");
  if (parts.length === 2) {
    return {
      x,
      y,
      origPath: parts[0],
      path: parts[1],
    };
  }
  return {
    x,
    y,
    origPath: null,
    path: parts[0],
  };
}

// Inspired in https://github.com/brandon-rhodes/uncommitted/blob/master/uncommitted/command.py

export type CheckDirtyOpts = Readonly<{
  untrackedFiles: "no" | "normal" | "all";
  showIgnored: boolean;
}>;

export async function checkDirty(
  folder: string,
  opts: CheckDirtyOpts
): Promise<readonly GitStatusShortFormat[]> {
  // Check whether current branch is dirty
  const result = await GitProcess.exec(
    [
      "status",
      `--untracked-files=${opts.untrackedFiles}`,
      opts.showIgnored ? "--ignored=traditional" : "--ignored=no",
      "--porcelain",
    ],
    folder
  );
  if (result.exitCode === 0) {
    return getLines(result.stdout).map(parseGitStatusShortFormat);
  }
  return handleGitError(result);
}

export async function checkUnpushed(
  folder: string
): Promise<readonly string[]> {
  // Check all branches for unpushed commits or branches without upstream
  // %(upstream) will be an empty string if there is no upstream
  // %(push:track) prints something like "[ahead 1]" when there are unpushed commits
  const result = await GitProcess.exec(
    [
      "for-each-ref",
      "--format=[%(refname:short)]%(upstream)%(push:track)",
      "refs/heads",
    ],
    folder
  );
  if (result.exitCode === 0) {
    return getLines(result.stdout).filter(l => l.endsWith("]"));
  }
  return handleGitError(result);
}

export async function checkStashes(folder: string): Promise<readonly string[]> {
  // Check all stashes
  const result = await GitProcess.exec(["stash", "list"], folder);
  if (result.exitCode === 0) {
    return getLines(result.stdout);
  }
  return handleGitError(result);
}

export async function checkSubmodules(
  folder: string
): Promise<readonly string[]> {
  // Get submodules
  const result = await GitProcess.exec(["submodule", "status"], folder);
  if (result.exitCode === 0) {
    return getLines(result.stdout)
      .map(l => (l.match(/^[-+U ]*\S+ (.*) \([^)]*\)$/) ?? ["", ""])[1])
      .filter(Boolean);
  }
  return handleGitError(result);
}
