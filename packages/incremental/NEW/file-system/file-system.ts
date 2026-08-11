import chokidarWatcher from "chokidar";
import { dirname } from "path";
import { normalizePath } from "../../../util/path-url";
import type { Logger } from "../../../util/logger";
import type { IncrementalBackend, IncrementalOpts } from "../runtime/backend";
import type { IncrementalContextRuntime } from "../runtime/functions";
import { IncrementalFile } from "./file";

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

export class IncrementalFS {
  public readonly logger: Logger;
  private readonly files: Map<string, IncrementalFile>;
  private readonly unreachable: Set<IncrementalFile>;
  private watcher: chokidarWatcher.FSWatcher | null;

  constructor(
    private readonly opts: IncrementalOpts,
    public readonly backend: IncrementalBackend<any>
  ) {
    this.logger = backend.logger.createChildLogger("file-system");
    this.files = new Map();
    this.unreachable = new Set();
    this.watcher = null;
  }

  _deleteFile(file: IncrementalFile) {
    this.files.delete(file.path);
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

  getFile(path: string): IncrementalFile {
    let info = this.files.get(path);
    if (info == null) {
      info = new IncrementalFile(this, path);
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
    if ([...files.values()].some(f => !f.isOrphan())) {
      throw new Error("There are dependencies on this file system");
    }
    files.clear();
    if (watcher) {
      this.watcher = null;
      await watcher.close();
    }
  }
}
