// import { default as parcelWatcher } from "@parcel/watcher";
import chokidarWatcher from "chokidar";
import fsextra from "fs-extra";
import { dirname } from "path";
import { normalizePath } from "../../../util/path-url";
import type {
  ComputationRegistry,
  IncrementalOpts,
} from "../../incremental-lib";
import { serializationDB } from "../../utils/serialization-db";
import {
  type ComputationResult,
  ok,
  type VersionedComputationResult,
} from "../../utils/result";
import {
  type SubscribableComputation,
  SubscribableComputationMixin,
} from "../mixins/subscribable";
import {
  type AnyRawComputation,
  RawComputation,
  type RawComputationContext,
  type StateNotCreating,
  type StateNotDeleted,
} from "../raw";
import { ComputationDescription } from "../description";
import { CacheableComputationMixin } from "../mixins/cacheable";
import { never } from "../../../util/miscellaneous";

export enum FileChange {
  ADD_OR_REMOVE = "ADD_OR_REMOVE",
  CHANGE = "CHANGE",
}

type FileComputationDescriptionJSON = {
  readonly path: string;
  readonly type: FileChange;
  readonly recursive: boolean;
};

export class FileComputationDescription
  extends ComputationDescription<FileComputation>
  implements FileComputationDescriptionJSON
{
  readonly path: string;
  readonly type: FileChange;
  readonly recursive: boolean;
  readonly json: string;

  constructor(path: string, type: FileChange, recursive: boolean) {
    super();
    this.path = path;
    this.type = type;
    this.recursive = recursive;
    this.json = JSON.stringify({ path, type, recursive });
  }

  create(registry: ComputationRegistry<any>): FileComputation {
    return new FileComputation(registry, this);
  }

  equal<O extends AnyRawComputation>(
    other: ComputationDescription<O>
  ): boolean {
    return (
      other instanceof FileComputationDescription &&
      this.path === other.path &&
      this.type === other.type &&
      this.recursive === other.recursive
    );
  }

  hash() {
    return this.path.length + 31 * this.type.length + (this.recursive ? 1 : 2);
  }

  getCacheKey() {
    return this.json;
  }
}

serializationDB.register<
  FileComputationDescription,
  FileComputationDescriptionJSON
>(FileComputationDescription, {
  name: "FileComputationDescription",
  serialize(value) {
    return {
      path: value.path,
      type: value.type,
      recursive: value.recursive,
    };
  },
  deserialize({ path, type, recursive }) {
    return new FileComputationDescription(path, type, recursive);
  },
});

class FileComputation
  extends RawComputation<RawComputationContext, bigint>
  implements SubscribableComputation<bigint>
{
  public readonly desc: FileComputationDescription;
  public readonly subscribableMixin: SubscribableComputationMixin<bigint>;
  public readonly cacheableMixin: CacheableComputationMixin<FileComputation>;
  public readonly fs: FileSystem;

  constructor(
    registry: ComputationRegistry<any>,
    desc: FileComputationDescription
  ) {
    super(registry, desc);
    this.desc = desc;
    this.subscribableMixin = new SubscribableComputationMixin(this);
    this.cacheableMixin = new CacheableComputationMixin(this, desc);
    this.fs = registry.fs;
  }

  externalInvalidate() {
    this.registry.externalInvalidate(this);
  }

  protected async exec(
    ctx: RawComputationContext
  ): Promise<ComputationResult<bigint>> {
    if (this.registry.invalidationsAllowed()) {
      await this.fs._sub(this);
    }
    if (this.desc.recursive) {
      return ok(0n);
    }
    await this.cacheableMixin.preExec();
    const { birthtimeNs, mtimeNs } = await fsextra.stat(this.desc.path, {
      bigint: true,
    });
    switch (this.desc.type) {
      case FileChange.ADD_OR_REMOVE:
        return ok(birthtimeNs);
      case FileChange.CHANGE:
        return ok(mtimeNs);
      default:
        never(this.desc.type);
    }
  }

  protected makeContext(runId: number): RawComputationContext {
    return {
      checkActive: () => this.checkActive(runId),
    };
  }

  protected isOrphan(): boolean {
    return this.subscribableMixin.isOrphan();
  }

  protected finishRoutine(result: VersionedComputationResult<bigint>) {
    result = this.subscribableMixin.finishRoutine(result);
    result = this.cacheableMixin.finishRoutine(result, false);
    return result;
  }

  protected invalidateRoutine(): void {
    this.subscribableMixin.invalidateRoutine();
    this.cacheableMixin.invalidateRoutine();
  }

  protected deleteRoutine(): void {
    this.fs._unsub(this);
    this.subscribableMixin.deleteRoutine();
    this.cacheableMixin.deleteRoutine();
  }

  protected onStateChange(from: StateNotDeleted, to: StateNotCreating): void {}

  responseEqual(a: bigint, b: bigint): boolean {
    return this.desc.recursive ? false : a === b;
  }
}

class FileInfo {
  private ready: Promise<any> | null;
  readonly path: string;
  readonly parentPath: string;
  readonly events: {
    [FileChange.ADD_OR_REMOVE]: {
      desc: FileComputationDescription;
      computations: Set<FileComputation>;
    };
    [FileChange.CHANGE]: {
      desc: FileComputationDescription;
      computations: Set<FileComputation>;
    };
  };
  readonly recEvents: {
    [FileChange.ADD_OR_REMOVE]: {
      desc: FileComputationDescription;
      computations: Set<FileComputation>;
    };
    [FileChange.CHANGE]: {
      desc: FileComputationDescription;
      computations: Set<FileComputation>;
    };
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

const PARCEL_EVENT_TO_FILE_CHANGE = {
  create: FileChange.ADD_OR_REMOVE,
  delete: FileChange.ADD_OR_REMOVE,
  update: FileChange.CHANGE,
} as const;

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
    private readonly opts: IncrementalOpts<any>,
    private readonly registry: ComputationRegistry<any>
  ) {
    this.files = new Map();
    this.watcher = null;
  }

  private react(event: FileChange, path: string, recursive: boolean) {
    this.registry.callUserFn(null, this.opts.fs.onEvent, {
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

  async _sub(computation: FileComputation) {
    const { path } = computation.desc;
    await this.getInfo(path).sub(computation, this.getWatcher());
  }

  _unsub(computation: FileComputation) {
    const { path } = computation.desc;
    this.getInfo(path).unsub(computation, this.watcher);
  }

  get(
    originalPath: string,
    type: FileChange,
    recursive: boolean
  ): FileComputationDescription {
    return recursive
      ? this.getInfo(normalizePath(originalPath)).recEvents[type].desc
      : this.getInfo(normalizePath(originalPath)).events[type].desc;
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

type SimpleContext = {
  readonly get: <T>(
    dep: ComputationDescription<
      RawComputation<any, T> & SubscribableComputation<T>
    >
  ) => Promise<ComputationResult<T>>;
};
