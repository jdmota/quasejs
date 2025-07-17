import {
  DependentComputation,
  DependentComputationMixin,
} from "../mixins/dependent";
import {
  RawComputation,
  State,
  RunId,
  StateNotDeleted,
  StateNotCreating,
  AnyRawComputation,
} from "../raw";
import {
  SubscribableComputation,
  SubscribableComputationMixin,
} from "../mixins/subscribable";
import {
  ComputationDescription,
  ComputationRegistry,
} from "../../incremental-lib";
import {
  ValueDefinition,
  ReadonlySnapshotHashMap,
  HashMap,
} from "../../utils/hash-map";
import {
  ComputationResult,
  resultEqual,
  ok,
  VersionedComputationResult,
} from "../../utils/result";
import { ComputationJobContext, ComputationJobDescription } from "./job";
import {
  ComputationEntryJobContext,
  ComputationEntryJobDescription,
} from "./entry-job";
import {
  EmitterComputation,
  EmitterComputationMixin,
} from "../mixins/events/emitter";
import { CacheableComputationMixin } from "../mixins/cacheable";

type ComputationPoolContext = {
  readonly checkActive: () => void;
  readonly get: <T>(
    dep: ComputationDescription<
      RawComputation<any, T> & SubscribableComputation<T>
    >
  ) => Promise<ComputationResult<T>>;
};

type ComputationExec<Ctx, Res> = (ctx: Ctx) => Promise<ComputationResult<Res>>;

export type ComputationPoolConfig<Req, Res> = {
  readonly startExec: ComputationExec<
    ComputationEntryJobContext<Req>,
    undefined
  >;
  readonly exec: ComputationExec<ComputationJobContext<Req>, Res>;
  readonly requestDef: ValueDefinition<Req>;
  readonly responseDef: ValueDefinition<Res>;
};

export function newComputationPool<Req, Res>(
  config: ComputationPoolConfig<Req, Res>
) {
  return new ComputationPoolDescription(config);
}

export class ComputationPoolDescription<Req, Res>
  implements ComputationDescription<ComputationPool<Req, Res>>
{
  readonly config: ComputationPoolConfig<Req, Res>;

  constructor(config: ComputationPoolConfig<Req, Res>) {
    this.config = config;
  }

  create(registry: ComputationRegistry): ComputationPool<Req, Res> {
    return new ComputationPool(registry, this);
  }

  equal<O extends AnyRawComputation>(other: ComputationDescription<O>) {
    return (
      other instanceof ComputationPoolDescription &&
      this.config.startExec === other.config.startExec &&
      this.config.exec === other.config.exec &&
      this.config.requestDef === other.config.requestDef &&
      this.config.responseDef === other.config.responseDef
    );
  }

  hash() {
    return 0;
  }
}

export class ComputationPool<Req, Res>
  extends RawComputation<
    ComputationPoolContext,
    ReadonlySnapshotHashMap<Req, ComputationResult<Res>>
  >
  implements
    DependentComputation,
    SubscribableComputation<
      ReadonlySnapshotHashMap<Req, ComputationResult<Res>>
    >,
    EmitterComputation<
      Req,
      ComputationResult<Res>,
      ReadonlySnapshotHashMap<Req, ComputationResult<Res>>
    >
{
  public readonly dependentMixin: DependentComputationMixin;
  public readonly subscribableMixin: SubscribableComputationMixin<
    ReadonlySnapshotHashMap<Req, ComputationResult<Res>>
  >;
  public readonly emitterMixin: EmitterComputationMixin<
    Req,
    ComputationResult<Res>,
    ReadonlySnapshotHashMap<Req, ComputationResult<Res>>
  >;
  public readonly cacheableMixin: CacheableComputationMixin<
    ComputationPool<Req, Res>
  >;
  //
  public readonly config: ComputationPoolConfig<Req, Res>;
  private readonly entryDescription: ComputationEntryJobDescription<Req, Res>;
  private readonly entryStatus: [number, number, number, number];
  private readonly data: {
    readonly reachable: {
      results: HashMap<Req, ComputationResult<Res>>;
      status: [number, number, number, number];
    };
    readonly unreachable: {
      results: HashMap<Req, ComputationResult<Res>>;
      status: [number, number, number, number];
    };
  };
  private readonly equal: (
    a: ComputationResult<Res>,
    b: ComputationResult<Res>
  ) => boolean;
  private readonly emitRunId: number;

  constructor(
    registry: ComputationRegistry,
    private readonly desc: ComputationPoolDescription<Req, Res>
  ) {
    super(registry, desc, false);
    this.equal = (a, b) => resultEqual(desc.config.responseDef.equal, a, b);
    this.dependentMixin = new DependentComputationMixin(this);
    this.subscribableMixin = new SubscribableComputationMixin(this);
    this.emitterMixin = new EmitterComputationMixin(
      this,
      desc.config.requestDef,
      this.equal
    );
    this.cacheableMixin = new CacheableComputationMixin(this, desc);
    this.config = desc.config;
    this.entryDescription = new ComputationEntryJobDescription(this);
    this.entryStatus = [0, 0, 0, 0];
    this.data = {
      reachable: {
        results: this.emitterMixin.getResults(),
        status: [0, 0, 0, 0],
      },
      unreachable: {
        results: new HashMap<Req, ComputationResult<Res>>(
          desc.config.requestDef
        ),
        status: [0, 0, 0, 0],
      },
    };
    this.emitRunId = this.emitterMixin.newEmitRunId();
    this.mark(State.PENDING);
  }

  // Note: do not use cacheableMixin.exec (see comment there)
  protected async exec(
    ctx: ComputationPoolContext,
    runId: RunId
  ): Promise<
    ComputationResult<ReadonlySnapshotHashMap<Req, ComputationResult<Res>>>
  > {
    const startResult = await ctx.get(this.entryDescription);
    if (!startResult.ok) {
      return startResult;
    }
    return this.emitterMixin.exec(runId, this.emitRunId);
  }

  protected makeContext(runId: RunId): ComputationPoolContext {
    return {
      checkActive: () => this.checkActive(runId),
      ...this.dependentMixin.makeContextRoutine(runId),
    };
  }

  protected isOrphan(): boolean {
    return this.subscribableMixin.isOrphan() && this.emitterMixin.isOrphan();
  }

  protected finishRoutine(
    result: VersionedComputationResult<
      ReadonlySnapshotHashMap<Req, ComputationResult<Res>>
    >
  ) {
    result = this.subscribableMixin.finishRoutine(result);
    result = this.cacheableMixin.finishRoutine(result);
    return result;
  }

  protected invalidateRoutine(): void {
    this.dependentMixin.invalidateRoutine();
    this.subscribableMixin.invalidateRoutine();
    this.cacheableMixin.invalidateRoutine();
    this.emitterMixin.invalidateRoutine();
  }

  protected deleteRoutine(): void {
    this.dependentMixin.deleteRoutine();
    this.subscribableMixin.deleteRoutine();
    this.cacheableMixin.deleteRoutine();
    this.emitterMixin.resetRoutine();
  }

  protected onStateChange(from: StateNotDeleted, to: StateNotCreating): void {}

  override responseEqual(
    a: ReadonlySnapshotHashMap<Req, ComputationResult<Res>>,
    b: ReadonlySnapshotHashMap<Req, ComputationResult<Res>>
  ): boolean {
    return a.strictContentEquals(b);
  }

  onNewResult(
    result: VersionedComputationResult<
      ReadonlySnapshotHashMap<Req, ComputationResult<Res>>
    >
  ): void {}

  make(request: Req) {
    return this.registry.make(
      new ComputationJobDescription(request, this.desc)
    );
  }

  private isDone() {
    const { entryStatus } = this;
    const { status } = this.data.reachable;
    return (
      entryStatus[State.PENDING] +
        entryStatus[State.RUNNING] +
        status[State.PENDING] +
        status[State.RUNNING] ===
      0
    );
  }

  onFieldFinish(
    reachable: boolean,
    req: Req,
    result: VersionedComputationResult<Res>
  ): void {
    if (this.isDeleting()) return;
    const map = reachable
      ? this.data.reachable.results
      : this.data.unreachable.results;
    map.set(req, result.result, this.equal);
  }

  onFieldDeleted(reachable: boolean, req: Req): void {
    if (this.isDeleting()) return;
    const map = reachable
      ? this.data.reachable.results
      : this.data.unreachable.results;
    map.delete(req);
  }

  onFieldReachabilityChange(
    state: State,
    req: Req,
    from: boolean,
    to: boolean
  ): void {
    if (this.isDeleting()) return;
    const fromData = from ? this.data.reachable : this.data.unreachable;
    const toData = to ? this.data.reachable : this.data.unreachable;

    if (state !== State.CREATING && state !== State.DELETED) {
      fromData.status[state]--;
      toData.status[state]++;
    }

    const result = fromData.results.delete(req);
    if (result) toData.results.set(req, result);

    this.react();
  }

  onFieldStateChange(
    reachable: boolean,
    from: StateNotDeleted,
    to: StateNotCreating
  ): void {
    if (this.isDeleting()) return;
    const status = reachable
      ? this.data.reachable.status
      : this.data.unreachable.status;

    if (from !== State.CREATING) {
      status[from]--;
    }
    if (to !== State.DELETED) {
      status[to]++;
    }

    this.react();
  }

  onEntryStateChange(from: StateNotDeleted, to: StateNotCreating): void {
    if (this.isDeleting()) return;
    const status = this.entryStatus;

    if (from !== State.CREATING) {
      status[from]--;
    }
    if (to !== State.DELETED) {
      status[to]++;
    }

    this.react();
  }

  // React to possible changes
  private react() {
    if (this.isDone()) {
      this.emitterMixin.done(
        this.emitRunId,
        ok(this.data.reachable.results.getSnapshot())
      );
    }
  }
}
