import type { BigIntStats, Stats } from "fs";
import fsextra from "fs-extra";
import chokidarWatcher from "chokidar";
import { dirname } from "path";
import { never } from "../../../util/miscellaneous";
import { normalizePath } from "../../../util/path-url";
import { serializationDB } from "../../utils/serialization-db";
import { valueDesc } from "../descriptions/values";
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

export enum FileChange {
  ADD_OR_REMOVE = "ADD_OR_REMOVE",
  CHANGE = "CHANGE",
}

const NO_TIMESTAMP: bigint = -1n;

const timestampValDef = valueDesc<bigint, any>(
  (a, b) => (a < 0 || b < 0 ? false : a === b),
  val => 0,
  val => val,
  val => val,
  val => val + ""
);

export class IncrementalFileDescription extends IncrementalCellDescription<bigint> {
  constructor(
    readonly path: string,
    readonly type: FileChange,
    readonly recursive: boolean
  ) {
    super(FileSystemDescription.SINGLETON);
  }

  equal(other: unknown): boolean {
    return (
      other instanceof IncrementalFileDescription &&
      this.path === other.path &&
      this.type === other.type &&
      this.recursive === other.recursive
    );
  }

  hash() {
    return this.path.length + 31 * this.type.length + (this.recursive ? 1 : 2);
  }

  getCacheKey() {
    return `File(${this.path},${this.type},${this.recursive})`;
  }

  format() {
    return `File(${this.path},${this.type},${this.recursive})`;
  }
}

type IncrementalFileDescriptionJSON = {
  readonly path: string;
  readonly type: FileChange;
  readonly recursive: boolean;
};

serializationDB.register<
  IncrementalFileDescription,
  IncrementalFileDescriptionJSON
>(IncrementalFileDescription, {
  name: "IncrementalFileDescription",
  serialize: value => {
    return {
      path: value.path,
      type: value.type,
      recursive: value.recursive,
    };
  },
  deserialize: ({ path, type, recursive }) => {
    return new IncrementalFileDescription(path, type, recursive);
  },
});

type FileCell = IncrementalCellRuntime<IncrementalFileDescription>;

function createFileCell(
  fs: FileSystem,
  path: string,
  type: FileChange,
  recursive: boolean
): FileCell {
  return new IncrementalCellRuntime(
    fs.backend,
    fs,
    new IncrementalFileDescription(path, type, recursive),
    timestampValDef
  );
}

async function getTimestamp(
  path: string,
  type: FileChange,
  stats: Stats | BigIntStats | null | undefined
) {
  const { birthtimeNs, mtimeNs } =
    stats != null && "birthtimeNs" in stats
      ? stats
      : await fsextra.stat(path, {
          bigint: true,
        });
  switch (type) {
    case FileChange.ADD_OR_REMOVE:
      return birthtimeNs;
    case FileChange.CHANGE:
      return mtimeNs;
    default:
      never(type);
  }
}

class FileInfo {
  readonly path: string;
  readonly events: {
    [FileChange.ADD_OR_REMOVE]: [FileCell, FileCell]; // non-recursive and recursive
    [FileChange.CHANGE]: [FileCell, FileCell];
  };
  private ready: Promise<unknown> | null;

  constructor(fs: FileSystem, path: string) {
    this.ready = null;
    this.path = path;
    this.events = {
      ADD_OR_REMOVE: [
        createFileCell(fs, path, FileChange.ADD_OR_REMOVE, false),
        createFileCell(fs, path, FileChange.ADD_OR_REMOVE, true),
      ],
      CHANGE: [
        createFileCell(fs, path, FileChange.CHANGE, false),
        createFileCell(fs, path, FileChange.CHANGE, true),
      ],
    };
  }

  sub(watcher: chokidarWatcher.FSWatcher) {
    if (!this.ready) {
      this.ready = watcher.addPromise(this.path);
    }
    return this.ready;
  }

  unsub(watcher: chokidarWatcher.FSWatcher | null) {
    if (this.subsCount() === 0) {
      this.ready = null;
      if (watcher) {
        watcher.unwatch(this.path);
      }
    }
  }

  reactFile(type: FileChange, timestamp: bigint) {
    this.events[type][0].set(timestamp);
  }

  reactRecursive(type: FileChange) {
    this.events[type][1].set(NO_TIMESTAMP);
  }

  depend(
    ctx: IncrementalContextRuntime<any, any, any>,
    change: FileChange,
    recursive: boolean
  ) {
    return ctx._read(this.events[change][+recursive]);
  }

  subsCount() {
    return (
      this.events.ADD_OR_REMOVE[0].readersCount() +
      this.events.ADD_OR_REMOVE[1].readersCount() +
      this.events.CHANGE[0].readersCount() +
      this.events.CHANGE[1].readersCount()
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

class FileSystemDescription implements IncrementalCellOwnerDescription {
  static readonly SINGLETON = new FileSystemDescription();

  equal(other: unknown): boolean {
    return other instanceof FileSystemDescription;
  }

  hash(): number {
    return 0;
  }

  getCacheKey(): string {
    return "FileSystem";
  }

  format(): string {
    return "FileSystem";
  }
}

serializationDB.register<FileSystemDescription, string>(FileSystemDescription, {
  name: "FileSystemDescription",
  serialize: value => {
    return "FileSystemDescription";
  },
  deserialize: out => {
    return FileSystemDescription.SINGLETON;
  },
});

export class FileSystem implements IncrementalCellOwner {
  public readonly desc0: IncrementalCellOwnerDescription =
    FileSystemDescription.SINGLETON;
  private readonly files: Map<string, FileInfo>;
  private watcher: chokidarWatcher.FSWatcher | null;

  constructor(
    private readonly opts: IncrementalOpts,
    public readonly backend: IncrementalBackend
  ) {
    this.files = new Map();
    this.watcher = null;
  }

  inv() {}

  // TODO deal with caching and reloading from disk
  // TODO on first sub, we need to get the timestamp

  getCell<Desc extends IncrementalCellDescription<any>>(
    desc: Desc
  ): IncrementalCellRuntime<Desc> | undefined {
    if (desc instanceof IncrementalFileDescription) {
      return this.getInfo(desc.path).events[desc.type][+desc.recursive] as any;
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

  private react(
    event: FileChange,
    path: string,
    recursive: boolean,
    timestamp: bigint
  ) {
    this.backend.callUserFn(null, this.opts.fs.onEvent, {
      event,
      path,
      recursive,
    });
    const info = this.files.get(path);
    if (info) {
      if (!recursive) {
        info.reactFile(event, timestamp);
      }
      info.reactRecursive(event);
    }
    const parent = normalizePath(dirname(path));
    if (parent !== path) {
      this.react(event, parent, true, NO_TIMESTAMP);
    }
  }

  private getInfo(path: string): FileInfo {
    let info = this.files.get(path);
    if (info == null) {
      info = new FileInfo(this, path);
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
      watcher.on("all", async (event, _path, stats) => {
        const type = CHOKIDAR_EVENT_TO_FILE_CHANGE[event];
        const path = normalizePath(_path);
        // TODO handle errors, and eventual data-races
        this.react(
          type,
          path,
          false,
          event.startsWith("unlink")
            ? NO_TIMESTAMP
            : await getTimestamp(path, type, stats)
        );
      });
    }
    return this.watcher;
  }

  // TODO when to unsub from watcher?

  async depend<T>(
    ctx: IncrementalContextRuntime<any, any, any>,
    originalPath: string,
    fn: (path: string) => T | Promise<T>,
    type: FileChange | null = null,
    rec: boolean = false
  ) {
    const path = normalizePath(originalPath);
    const info = this.getInfo(path);
    if (this.backend.invalidationsAllowed()) {
      // Subscribe to watcher
      await info.sub(this.getWatcher());
    }
    // Depend on the cells
    if (type == null) {
      await Promise.all([
        info.depend(ctx, FileChange.ADD_OR_REMOVE, rec),
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
