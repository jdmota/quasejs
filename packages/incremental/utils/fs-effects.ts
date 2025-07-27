import fsextra, { type WriteFileOptions } from "fs-extra";
import path from "path";
import { isPathInside } from "../../util/path-url";
import fastGlob from "fast-glob";

export class FsEffectsDB<Owner> {
  private map = new Map<string, [Owner, FsEffects]>();

  requestFolder(owner: Owner, folder: string): FsEffects {
    folder = path.resolve(folder);
    let curr = this.map.get(folder);
    if (curr) {
      if (curr[0] === owner) {
        return curr[1];
      }
      throw new Error("Folder is already owned");
    }
    curr = [owner, new FsEffects(folder)];
    this.map.set(folder, curr);
    return curr[1];
  }
}

class FsEffects {
  private files = new Set<string>();

  constructor(readonly folder: string) {}

  glob(patterns: string | string[], opts?: Omit<fastGlob.Options, "cwd">) {
    return fastGlob.stream(patterns, {
      absolute: true,
      ...opts,
      cwd: this.folder,
    });
  }

  async outputFile(
    file: string,
    contents: string | NodeJS.ArrayBufferView | Buffer,
    options?: WriteFileOptions
  ) {
    const fullPath = path.resolve(this.folder, file);
    if (isPathInside(fullPath, this.folder)) {
      this.files.add(fullPath);
      return fsextra.outputFile(fullPath, contents as any, options);
    }
    throw new Error(`Writing ${file} outside of folder`);
  }

  resetTracking() {
    this.files.clear();
  }

  async clean() {
    const removeJobs = [];
    for await (let file of this.glob("**", { onlyFiles: true })) {
      file = file.toString();
      if (!this.files.has(file)) {
        removeJobs.push(fsextra.remove(file));
      }
    }
    for (const job of removeJobs) {
      await job;
    }
  }
}
