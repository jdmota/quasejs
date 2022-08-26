import { FSWatcher, watch, WatchListener } from "fs";
import {
  ComputationDescription,
  ComputationRegistry,
} from "../../incremental-lib";
import { makeAbsolute } from "../../utils/path";
import { Result, ok } from "../../utils/result";
import {
  SubscribableComputation,
  SubscribableComputationMixin,
} from "../mixins/subscribable";
import {
  AnyRawComputation,
  RawComputation,
  RunId,
  State,
  StateNotCreating,
  StateNotDeleted,
} from "../raw";

export enum FileChange {
  ADD_OR_REMOVE = 0,
  CHANGE = 1,
}

export class FileComputationDescription
  implements ComputationDescription<FileComputation>
{
  readonly fs: FileSystem;
  readonly path: string;
  readonly type: FileChange;

  constructor(fs: FileSystem, path: string, type: FileChange) {
    this.fs = fs;
    this.path = path;
    this.type = type;
  }

  create(registry: ComputationRegistry): FileComputation {
    return new FileComputation(registry, this);
  }

  equal<O extends AnyRawComputation>(
    other: ComputationDescription<O>
  ): boolean {
    return (
      other instanceof FileComputationDescription &&
      this.fs === other.fs &&
      this.path === other.path &&
      this.type === other.type
    );
  }

  hash() {
    return this.path.length + 31 * this.type;
  }
}

class FileComputation
  extends RawComputation<FileComputationDescription, undefined>
  implements SubscribableComputation<undefined>
{
  public readonly subscribableMixin: SubscribableComputationMixin<undefined>;
  public readonly desc: FileComputationDescription;

  constructor(
    registry: ComputationRegistry,
    description: FileComputationDescription
  ) {
    super(registry, description, false);
    this.subscribableMixin = new SubscribableComputationMixin(this);
    this.desc = description;
    this.mark(State.PENDING);
  }

  protected async exec(
    ctx: FileComputationDescription
  ): Promise<Result<undefined>> {
    return ok(undefined);
  }

  protected makeContext(runId: RunId): FileComputationDescription {
    return this.desc;
  }

  protected isOrphan(): boolean {
    return this.subscribableMixin.isOrphan();
  }

  protected finishRoutine(result: Result<undefined>): void {
    this.subscribableMixin.finishRoutine(result);
  }

  protected invalidateRoutine(): void {
    this.subscribableMixin.invalidateRoutine();
  }

  protected deleteRoutine(): void {
    this.subscribableMixin.deleteRoutine();
  }

  protected onStateChange(from: StateNotDeleted, to: StateNotCreating): void {}

  responseEqual(a: undefined, b: undefined): boolean {
    return false;
  }

  onNewResult(result: Result<undefined>): void {}

  private subs: number = 0;
  private readonly listener: WatchListener<string> = (event, filename) => {
    this.invalidate();
  };

  override onInEdgeAddition(node: AnyRawComputation): void {
    this.subs++;
    if (this.subs === 1 && this.registry.allowInvalidations()) {
      this.desc.fs._sub(this.desc, this.listener);
    }
  }

  override onInEdgeRemoval(node: AnyRawComputation): void {
    this.subs--;
    if (this.subs === 0 && this.registry.allowInvalidations()) {
      this.desc.fs._unsub(this.desc, this.listener);
    }
  }
}

type FileInfo = {
  readonly path: string;
  addOrRemove: FileComputationDescription | null;
  change: FileComputationDescription | null;
  time: number;
  watcher: FSWatcher | null;
};

export class FileSystem {
  private readonly files: Map<string, FileInfo>;

  constructor() {
    this.files = new Map();
  }

  private getInfo(path: string) {
    let info = this.files.get(path);
    if (info == null) {
      info = {
        path,
        addOrRemove: null,
        change: null,
        // TODO need the timestamp?
        time: Date.now(),
        watcher: null,
      };
      this.files.set(path, info);
    }
    return info;
  }

  // TODO use better watcher that does not fail on non-existance files

  _sub(desc: FileComputationDescription, listener: WatchListener<string>) {
    const info = this.getInfo(desc.path);
    if (!info.watcher) {
      info.watcher = watch(info.path);
      info.watcher.addListener("error", () => {});
    }
    info.watcher.addListener("change", listener);
  }

  _unsub(desc: FileComputationDescription, listener: WatchListener<string>) {
    const info = this.getInfo(desc.path);
    if (info.watcher) {
      info.watcher.removeListener("change", listener);
      if (info.watcher.listenerCount("change") === 0) {
        info.watcher.close();
        info.watcher = null;
      }
    }
  }

  get(originalPath: string, type: FileChange) {
    const path = makeAbsolute(originalPath);
    const info = this.getInfo(path);
    if (type === FileChange.ADD_OR_REMOVE) {
      if (!info.addOrRemove) {
        info.addOrRemove = new FileComputationDescription(this, path, type);
      }
      return info.addOrRemove;
    } else {
      if (!info.change) {
        info.change = new FileComputationDescription(this, path, type);
      }
      return info.change;
    }
  }

  async depend<T>(
    ctx: SimpleContext,
    originalPath: string,
    fn: (originalPath: string) => Promise<T>,
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
}

type SimpleContext = {
  readonly get: <T>(
    dep: ComputationDescription<
      RawComputation<any, T> & SubscribableComputation<T>
    >
  ) => Promise<Result<T>>;
};
