import path from "path";
import fs from "fs-extra";
import { randString } from "../../util/random";

export class InDiskBlob {
  constructor(
    readonly file: string, // Relative to the dir set in BlobsDB
    readonly size: number // In bytes
  ) {}
}

// TODO when reloading a computation that has generated a blob
// we need to check if it is in disk, because others might depend on it
// This is like reloading a computation that previously had created a file system side-effect...
// Maybe we need that! (which will also be useful, e.g., when we get to the find output of a bundler)
export class BlobsDB {
  private readonly dir: string;

  constructor(dir: string) {
    this.dir = path.resolve(dir);
  }

  exists(inDisk: InDiskBlob) {
    return fs.exists(path.join(this.dir, inDisk.file));
  }

  async get(inDisk: InDiskBlob) {
    try {
      const buffer = await fs.readFile(path.join(this.dir, inDisk.file));
      if (buffer.byteLength === inDisk.size) {
        return buffer;
      }
      throw new Error(
        `In disk blob size mismatch (expected ${inDisk.size} but got ${buffer.byteLength})`
      );
    } catch (err: any) {
      if (err.code === "ENOENT") {
        return null;
      } else {
        throw err;
      }
    }
  }

  async set(contents: Buffer): Promise<InDiskBlob> {
    let size = 0;
    while (true) {
      size += 8;
      const key = randString(size);
      const file = `blobs_v1/${key.slice(0, 2)}/${key.slice(2)}.blob`;
      try {
        await fs.outputFile(path.join(this.dir, file), contents as any, {
          flag: "wx",
        });
        return new InDiskBlob(file, contents.byteLength);
      } catch (err: any) {
        if (err.code === "EEXIST") {
          // Try again to find a new key
        } else {
          throw err;
        }
      }
    }
  }
}
