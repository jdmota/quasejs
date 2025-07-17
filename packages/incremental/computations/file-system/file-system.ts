// import { default as parcelWatcher } from "@parcel/watcher";
import chokidarWatcher from "chokidar";
import fsextra from "fs-extra";
import { dirname } from "path";
import { normalizePath } from "../../../util/path-url";
import {
  ComputationDescription,
  ComputationRegistry,
} from "../../incremental-lib";
import {
  ComputationResult,
  ok,
  VersionedComputationResult,
} from "../../utils/result";
import {
  SubscribableComputation,
  SubscribableComputationMixin,
} from "../mixins/subscribable";
import {
  AnyRawComputation,
  RawComputation,
  RawComputationContext,
  RunId,
  State,
  StateNotCreating,
  StateNotDeleted,
} from "../raw";
import { CacheableComputationMixin } from "../mixins/cacheable";
import { never } from "../../../util/miscellaneous";

export enum FileChange {
  ADD_OR_REMOVE = "ADD_OR_REMOVE",
  CHANGE = "CHANGE",
}

export class FileComputationDescription
  implements ComputationDescription<FileComputation>
{
  readonly path: string;
  readonly type: FileChange;
  readonly json: string;

  constructor(path: string, type: FileChange) {
    this.path = path;
    this.type = type;
    this.json = JSON.stringify({ path, type });
  }

  create(registry: ComputationRegistry): FileComputation {
    return new FileComputation(registry, this);
  }

  equal<O extends AnyRawComputation>(
    other: ComputationDescription<O>
  ): boolean {
    return (
      other instanceof FileComputationDescription &&
      this.path === other.path &&
      this.type === other.type
    );
  }

  hash() {
    return this.path.length + 31 * this.type.length;
  }
}

class FileComputation
  extends RawComputation<RawComputationContext, bigint>
  implements SubscribableComputation<bigint>
{
  public readonly desc: FileComputationDescription;
  public readonly subscribableMixin: SubscribableComputationMixin<bigint>;
  public readonly cacheableMixin: CacheableComputationMixin<FileComputation>;
  public readonly fs: FileSystem;

  constructor(registry: ComputationRegistry, desc: FileComputationDescription) {
    super(registry, desc, false);
    this.desc = desc;
    this.subscribableMixin = new SubscribableComputationMixin(this);
    this.cacheableMixin = new CacheableComputationMixin(this, desc);
    this.fs = registry.fs;
    this.mark(State.PENDING);
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

  protected makeContext(runId: RunId): RawComputationContext {
    return {
      checkActive: () => this.checkActive(runId),
    };
  }

  protected isOrphan(): boolean {
    return this.subscribableMixin.isOrphan();
  }

  protected finishRoutine(result: VersionedComputationResult<bigint>) {
    result = this.subscribableMixin.finishRoutine(result);
    result = this.cacheableMixin.finishRoutine(result);
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

  onNewResult(result: VersionedComputationResult<bigint>): void {}
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

  constructor(path: string) {
    this.ready = null;
    this.path = path;
    this.parentPath = normalizePath(dirname(path));
    this.events = {
      ADD_OR_REMOVE: {
        desc: new FileComputationDescription(path, FileChange.ADD_OR_REMOVE),
        computations: new Set(),
      },
      CHANGE: {
        desc: new FileComputationDescription(path, FileChange.CHANGE),
        computations: new Set(),
      },
    };
  }

  sub(
    event: FileChange,
    comp: FileComputation,
    watcher: chokidarWatcher.FSWatcher
  ) {
    this.events[event].computations.add(comp);
    if (!this.ready) {
      this.ready = watcher.addPromise(this.path);
    }
    return this.ready;
  }

  unsub(
    event: FileChange,
    comp: FileComputation,
    watcher: chokidarWatcher.FSWatcher | null
  ) {
    this.events[event].computations.delete(comp);
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
      this.events.CHANGE.computations.size
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

export class FileSystem {
  // File infos
  private readonly files: Map<string, FileInfo>;
  // Watcher
  private watcher: chokidarWatcher.FSWatcher | null;

  constructor() {
    this.files = new Map();
    this.watcher = null;
  }

  private react(event: FileChange, path: string) {
    console.log("=====", event, path, "=====");
    const info = this.files.get(normalizePath(path));
    if (info) {
      for (const c of info.events[event].computations) {
        c.externalInvalidate();
      }
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
        this.react(CHOKIDAR_EVENT_TO_FILE_CHANGE[event], path);
      });
    }
    return this.watcher;
  }

  async _sub(computation: FileComputation) {
    const { path, type } = computation.desc;
    await this.getInfo(path).sub(type, computation, this.getWatcher());
  }

  _unsub(computation: FileComputation) {
    const { path, type } = computation.desc;
    this.getInfo(path).unsub(type, computation, this.watcher);
  }

  get(originalPath: string, type: FileChange): FileComputationDescription {
    return this.getInfo(normalizePath(originalPath)).events[type].desc;
  }

  async depend<T>(
    ctx: SimpleContext,
    originalPath: string,
    fn: (originalPath: string) => T | Promise<T>,
    type: FileChange | null = null
  ) {
    if (type == null) {
      await ctx.get(this.get(originalPath, FileChange.ADD_OR_REMOVE));
      await ctx.get(this.get(originalPath, FileChange.CHANGE));
    } else {
      await ctx.get(this.get(originalPath, type));
    }
    return fn(originalPath);
  }

  extend<Ctx extends SimpleContext>(ctx: Ctx): Ctx & CtxWithFS {
    return {
      ...ctx,
      fs: (a, b, c) => this.depend(ctx, a, b, c),
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
    c?: FileChange | null
  ) => Promise<T>;
};

type SimpleContext = {
  readonly get: <T>(
    dep: ComputationDescription<
      RawComputation<any, T> & SubscribableComputation<T>
    >
  ) => Promise<ComputationResult<T>>;
};
