import path from "path";
import type { Options } from "./types";
import { checkDirty, getDotGitDir, gitLs } from "../git/git";
import { setAdd } from "../util/maps-sets";

// Outputs absolute file names
export async function* collectFiles(options: Options) {
  const dotGitDir = await getDotGitDir(options.folder);
  if (dotGitDir == null) return;
  const rootGitProj = path.resolve(dotGitDir, "..");

  const files = new Set<string>();
  const allFiles = await (options.all
    ? gitLs(options.folder)
    : Promise.resolve([]));

  for await (const file of allFiles) {
    const full = path.resolve(rootGitProj, file);
    if (setAdd(files, full)) {
      yield full;
    }
  }

  const dirtyAll = await checkDirty(options.folder, {
    untrackedFiles: "all",
    showIgnored: false,
  });

  for await (const { path: file } of dirtyAll) {
    const full = path.resolve(rootGitProj, file);
    if (setAdd(files, full)) {
      yield full;
    }
  }
}
