import chokidarWatcher from "chokidar";
import { dirname } from "path";
import { $EQUALS, $FORMAT, $HASHCODE, $SERIALIZE } from "../../../util/values";
import { normalizePath } from "../../../util/path-url";
import { serializationRegistry } from "../../utils/serialization-db";
import type { Logger } from "../../../util/logger";
import {
  type IncrementalCellOwnerDescription,
  IncrementalCellDescription,
} from "../descriptions/cells";
import type { IncrementalBackend, IncrementalOpts } from "../runtime/backend";
import type { IncrementalContextRuntime } from "../runtime/functions";
import {
  type IncrementalCellOwner,
  IncrementalCellRuntime,
} from "../runtime/cells";
import { FileInfo, IncrementalFileDescription } from "./file";

export enum FileChange {
  ADD_REMOVE = "ADD_REMOVE",
  CHANGE = "CHANGE",
}

/* const PARCEL_EVENT_TO_FILE_CHANGE = {
  create: FileChange.ADD_OR_REMOVE,
  delete: FileChange.ADD_OR_REMOVE,
  update: FileChange.CHANGE,
} as const; */

const CHOKIDAR_EVENT_TO_FILE_CHANGE = {
  add: FileChange.ADD_REMOVE,
  addDir: FileChange.ADD_REMOVE,
  change: FileChange.CHANGE,
  unlink: FileChange.ADD_REMOVE,
  unlinkDir: FileChange.ADD_REMOVE,
} as const;

export type FileChangeEvent = {
  readonly event: FileChange;
  readonly path: string;
  readonly recursive: boolean;
};

export class IncrementalFSDescription
  implements IncrementalCellOwnerDescription
{
  static readonly SINGLETON = new IncrementalFSDescription();

  [$EQUALS](other: unknown): boolean {
    return other instanceof IncrementalFSDescription;
  }

  [$HASHCODE](): number {
    return 0;
  }

  getCacheKey(): string {
    return "IncrementalFSDescription";
  }

  [$FORMAT](): string {
    return "IncrementalFSDescription";
  }

  [$SERIALIZE]() {
    return {
      name: "IncrementalFSDescription",
      version: 1,
      value: null,
    };
  }
}

serializationRegistry.registerDeserializer<null, IncrementalFSDescription>(
  "IncrementalFSDescription",
  () => IncrementalFSDescription.SINGLETON
);

export class IncrementalFS implements IncrementalCellOwner {
  public readonly desc0: IncrementalCellOwnerDescription =
    IncrementalFSDescription.SINGLETON;
  public readonly logger: Logger;
  private readonly files: Map<string, FileInfo>;
  private readonly unreachable: Set<FileInfo>;
  private watcher: chokidarWatcher.FSWatcher | null;

  constructor(
    private readonly opts: IncrementalOpts,
    public readonly backend: IncrementalBackend
  ) {
    this.logger = backend.logger.createChildLogger("file-system");
    this.files = new Map();
    this.unreachable = new Set();
    this.watcher = null;
  }

  inv() {}

  getCell<Desc extends IncrementalCellDescription<any>>(
    desc: Desc
  ): IncrementalCellRuntime<Desc> | undefined {
    if (desc instanceof IncrementalFileDescription) {
      const file = this.getFile(desc.path);
      return (desc.recursive ? file.recCells : file.mainCells)[
        desc.type
      ] satisfies IncrementalCellRuntime<any> as any;
    }
  }

  demand(): void {}

  demandAndWait(): Promise<void> {
    return Promise.resolve();
  }

  isOrphan(): boolean {
    return false;
  }

  isRoot(): boolean {
    return true;
  }

  markRoot(root: boolean): void {
    // Always root
  }

  markReachable(file: FileInfo) {
    this.logger.debug("Reachable", file.path);
    this.unreachable.delete(file);
  }

  markUnreachable(file: FileInfo) {
    this.logger.debug("Unreachable", file.path);
    this.unreachable.add(file);
  }

  // TODO when to call this?
  gc() {
    this.logger.debug("GC");
    const unreachable = Array.from(this.unreachable);
    for (const file of unreachable) {
      if (file.delete()) {
        this.files.delete(file.path);
      }
    }
  }

  private react(event: FileChange, path: string, recursive: boolean) {
    this.logger.debug({
      event,
      path,
      recursive,
    });
    this.backend.callUserFn(null, this.opts.fs.onEvent, {
      event,
      path,
      recursive,
    });
    const info = this.files.get(path);
    if (info) {
      if (!recursive) {
        info.reactFile();
      }
      info.reactRecursive(event);
    }
    const parent = normalizePath(dirname(path));
    if (parent !== path) {
      this.react(event, parent, true);
    }
  }

  private getFile(path: string): FileInfo {
    let info = this.files.get(path);
    if (info == null) {
      info = new FileInfo(this, path);
      this.files.set(path, info);
    }
    return info;
  }

  getCurrentWatcher() {
    return this.watcher;
  }

  ensureWatcher() {
    if (!this.watcher) {
      const watcher = chokidarWatcher.watch([], {
        ignoreInitial: true,
        ignorePermissionErrors: true,
        ignored: /\.cache|\.git/,
        disableGlobbing: true,
      });
      this.watcher = watcher;
      watcher.on("all", async (event, path) => {
        this.react(
          CHOKIDAR_EVENT_TO_FILE_CHANGE[event],
          normalizePath(path),
          false
        );
      });
    }
    return this.watcher;
  }

  async depend<T>(
    ctx: IncrementalContextRuntime<any, any, any>,
    originalPath: string,
    fn: (path: string) => T | Promise<T>,
    type: FileChange | null = null,
    rec: boolean = false
  ) {
    const path = normalizePath(originalPath);
    const info = this.getFile(path);
    info.demand();
    if (type == null) {
      await Promise.all([
        info.depend(ctx, FileChange.ADD_REMOVE, rec),
        info.depend(ctx, FileChange.CHANGE, rec),
      ]);
    } else {
      await info.depend(ctx, type, rec);
    }
    return fn(path);
  }

  async close() {
    const { files, watcher } = this;
    if ([...files.values()].some(f => f.subsCount() > 0)) {
      throw new Error("There are dependencies on this file system");
    }
    files.clear();
    if (watcher) {
      this.watcher = null;
      await watcher.close();
    }
  }
}
