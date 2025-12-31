import chokidarWatcher from "chokidar";
import { dirname } from "path";
import { normalizePath } from "../../../../util/path-url";
import type { IncrementalBackend, IncrementalOpts } from "../backend";
import type { IncrementalFunctionRuntime } from "../function-runtime";

export enum FileChange {
  ADD_OR_REMOVE = "ADD_OR_REMOVE",
  CHANGE = "CHANGE",
}

class FileInfo {
  private ready: Promise<any> | null;
  readonly path: string;
  readonly parentPath: string;
  readonly events: {
    [FileChange.ADD_OR_REMOVE]: Set<FileComputation>;
    [FileChange.CHANGE]: Set<FileComputation>;
  };
  readonly recEvents: {
    [FileChange.ADD_OR_REMOVE]: Set<FileComputation>;
    [FileChange.CHANGE]: Set<FileComputation>;
  };

  constructor(path: string) {
    this.ready = null;
    this.path = path;
    this.parentPath = normalizePath(dirname(path));
    this.events = {
      ADD_OR_REMOVE: {
        desc: new FileComputationDescription(
          path,
          FileChange.ADD_OR_REMOVE,
          false
        ),
        computations: new Set(),
      },
      CHANGE: {
        desc: new FileComputationDescription(path, FileChange.CHANGE, false),
        computations: new Set(),
      },
    };
    this.recEvents = {
      ADD_OR_REMOVE: {
        desc: new FileComputationDescription(
          path,
          FileChange.ADD_OR_REMOVE,
          true
        ),
        computations: new Set(),
      },
      CHANGE: {
        desc: new FileComputationDescription(path, FileChange.CHANGE, true),
        computations: new Set(),
      },
    };
  }

  sub(comp: FileComputation, watcher: chokidarWatcher.FSWatcher) {
    if (comp.desc.recursive) {
      this.recEvents[comp.desc.type].computations.add(comp);
    } else {
      this.events[comp.desc.type].computations.add(comp);
    }
    if (!this.ready) {
      this.ready = watcher.addPromise(this.path);
    }
    return this.ready;
  }

  unsub(comp: FileComputation, watcher: chokidarWatcher.FSWatcher | null) {
    if (comp.desc.recursive) {
      this.recEvents[comp.desc.type].computations.delete(comp);
    } else {
      this.events[comp.desc.type].computations.delete(comp);
    }
    if (this.subsCount() === 0) {
      this.ready = null;
      if (watcher) {
        watcher.unwatch(this.path);
      }
    }
  }

  subsCount() {
    return (
      this.events.ADD_OR_REMOVE.computations.size +
      this.events.CHANGE.computations.size +
      this.recEvents.ADD_OR_REMOVE.computations.size +
      this.recEvents.CHANGE.computations.size
    );
  }
}

/* const PARCEL_EVENT_TO_FILE_CHANGE = {
  create: FileChange.ADD_OR_REMOVE,
  delete: FileChange.ADD_OR_REMOVE,
  update: FileChange.CHANGE,
} as const; */

const CHOKIDAR_EVENT_TO_FILE_CHANGE = {
  add: FileChange.ADD_OR_REMOVE,
  addDir: FileChange.ADD_OR_REMOVE,
  change: FileChange.CHANGE,
  unlink: FileChange.ADD_OR_REMOVE,
  unlinkDir: FileChange.ADD_OR_REMOVE,
} as const;

export type FileChangeEvent = {
  readonly event: FileChange;
  readonly path: string;
  readonly recursive: boolean;
};

export class FileSystem {
  // File infos
  private readonly files: Map<string, FileInfo>;
  // Watcher
  private watcher: chokidarWatcher.FSWatcher | null;

  constructor(
    private readonly opts: IncrementalOpts,
    private readonly backend: IncrementalBackend
  ) {
    this.files = new Map();
    this.watcher = null;
  }

  private react(event: FileChange, path: string, recursive: boolean) {
    this.backend.callUserFn(null, this.opts.fs.onEvent, {
      event,
      path,
      recursive,
    });
    const info = this.files.get(path);
    if (info) {
      if (!recursive) {
        for (const c of info.events[event].computations) {
          c.externalInvalidate();
        }
      }
      for (const c of info.recEvents[event].computations) {
        c.externalInvalidate();
      }
    }
    const parent = normalizePath(dirname(path));
    if (parent !== path) {
      this.react(event, parent, true);
    }
  }

  private getInfo(path: string): FileInfo {
    let info = this.files.get(path);
    if (info == null) {
      info = new FileInfo(path);
      this.files.set(path, info);
    }
    return info;
  }

  private getWatcher() {
    if (!this.watcher) {
      const watcher = chokidarWatcher.watch([], {
        ignoreInitial: true,
        ignorePermissionErrors: true,
        ignored: /\.cache|\.git/,
        disableGlobbing: true,
      });
      this.watcher = watcher;
      watcher.on("all", (event, path) => {
        this.react(
          CHOKIDAR_EVENT_TO_FILE_CHANGE[event],
          normalizePath(path),
          false
        );
      });
    }
    return this.watcher;
  }

  async sub(computation: FileComputation) {
    const { path } = computation.desc;
    await this.getInfo(path).sub(computation, this.getWatcher());
  }

  unsub(computation: FileComputation) {
    const { path } = computation.desc;
    this.getInfo(path).unsub(computation, this.watcher);
  }

  get(
    computation: IncrementalFunctionRuntime<any, any, any>,
    originalPath: string,
    type: FileChange,
    recursive: boolean
  ) {
    const path = normalizePath(originalPath);
    const info = this.getInfo(path);

    return recursive ? info.recEvents[type].desc : info.events[type].desc;
  }

  async depend<T>(
    ctx: SimpleContext,
    originalPath: string,
    fn: (originalPath: string) => T | Promise<T>,
    type: FileChange | null = null,
    rec: boolean = false
  ) {
    if (type == null) {
      await ctx.get(this.get(originalPath, FileChange.ADD_OR_REMOVE, rec));
      await ctx.get(this.get(originalPath, FileChange.CHANGE, rec));
    } else {
      await ctx.get(this.get(originalPath, type, rec));
    }
    return fn(originalPath);
  }

  extend<Ctx extends SimpleContext>(ctx: Ctx): Ctx & CtxWithFS {
    return {
      ...ctx,
      fs: (a, b, c, rec) => this.depend(ctx, a, b, c, rec),
    };
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

export type CtxWithFS = {
  readonly fs: <T>(
    a: string,
    b: (originalPath: string) => T | Promise<T>,
    c?: FileChange | null,
    rec?: boolean
  ) => Promise<T>;
};
