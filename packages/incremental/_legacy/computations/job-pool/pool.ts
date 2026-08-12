import {
  type DependentComputation,
  DependentComputationMixin,
} from "../mixins/dependent";
import {
  RawComputation,
  State,
  type StateNotDeleted,
  type StateNotCreating,
  type AnyRawComputation,
} from "../raw";
import { ComputationDescription } from "../description";
import {
  type SubscribableComputation,
  SubscribableComputationMixin,
} from "../mixins/subscribable";
import { type ComputationRegistry } from "../../incremental-lib";
import {
  type ValueDefinition,
  type ReadonlySnapshotHashMap,
  HashMap,
} from "../../utils/hash-map";
import {
  type ComputationResult,
  type VersionedComputationResult,
  resultEqual,
  resultStrictEqual,
  ok,
} from "../../utils/result";
import { type ComputationJobContext, ComputationJobDescription } from "./job";
import {
  type ComputationEntryJobContext,
  ComputationEntryJobDescription,
} from "./entry-job";
import {
  type EmitterComputation,
  EmitterComputationMixin,
} from "../mixins/emitter";
import { serializationDB } from "../../utils/serialization-db";

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
  readonly key: string;
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

export class ComputationPoolDescription<
  Req,
  Res,
> extends ComputationDescription<ComputationPool<Req, Res>> {
  readonly config: ComputationPoolConfig<Req, Res>;

  constructor(config: ComputationPoolConfig<Req, Res>) {
    super();
    this.config = config;
  }

  create(registry: ComputationRegistry<any>): ComputationPool<Req, Res> {
    return new ComputationPool(registry, this);
  }

  equal<O extends AnyRawComputation>(other: ComputationDescription<O>) {
    return (
      other instanceof ComputationPoolDescription &&
      this.config === other.config
    );
  }

  hash() {
    return 0;
  }

  getCacheKey() {
    return `Pool{${this.config.key}}`;
  }
}

serializationDB.register<
  ComputationPoolDescription<any, any>,
  ComputationPoolConfig<any, any>
>(ComputationPoolDescription, {
  name: "ComputationPoolDescription",
  serialize(value) {
    return value.config;
  },
  deserialize(out) {
    return new ComputationPoolDescription(out);
  },
});

export type PoolResult<Req, Res> = ReadonlySnapshotHashMap<
  Req,
  ComputationResult<Res>
>;

export class ComputationPool<Req, Res>
  extends RawComputation<ComputationPoolContext, PoolResult<Req, Res>>
  implements
    DependentComputation,
    SubscribableComputation<PoolResult<Req, Res>>,
    EmitterComputation<Req, ComputationResult<Res>, PoolResult<Req, Res>>
{
  public readonly dependentMixin: DependentComputationMixin;
  public readonly subscribableMixin: SubscribableComputationMixin<
    PoolResult<Req, Res>
  >;
  public readonly emitterMixin: EmitterComputationMixin<
    Req,
    ComputationResult<Res>,
    PoolResult<Req, Res>
  >;
  //
  public readonly config: ComputationPoolConfig<Req, Res>;
  private readonly entryDescription: ComputationEntryJobDescription<Req, Res>;
  private readonly entryStatus: [number, number, number, number];
  private entryData: ComputationResult<undefined>;
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
    registry: ComputationRegistry<any>,
    private readonly desc: ComputationPoolDescription<Req, Res>
  ) {
    super(registry, desc);
    this.equal = (a, b) => resultEqual(desc.config.responseDef.equal, a, b);
    this.dependentMixin = new DependentComputationMixin(this);
    this.subscribableMixin = new SubscribableComputationMixin(this);
    this.emitterMixin = new EmitterComputationMixin(
      this,
      desc.config.requestDef,
      this.equal
    );
    this.config = desc.config;
    this.entryDescription = new ComputationEntryJobDescription(desc);
    this.entryStatus = [0, 0, 0, 0];
    this.entryData = ok(undefined);
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
  }

  protected async exec(
    ctx: ComputationPoolContext,
    runId: number
  ): Promise<ComputationResult<PoolResult<Req, Res>>> {
    // Potential errors will be caught via "onEntryFinish"
    await ctx.get(this.entryDescription);
    return this.emitterMixin.exec(runId, this.emitRunId);
  }

  protected makeContext(runId: number): ComputationPoolContext {
    return {
      checkActive: () => this.checkActive(runId),
      ...this.dependentMixin.makeContextRoutine(runId),
    };
  }

  protected isOrphan(): boolean {
    return this.subscribableMixin.isOrphan() && this.emitterMixin.isOrphan();
  }

  protected finishRoutine(
    result: VersionedComputationResult<PoolResult<Req, Res>>
  ) {
    result = this.subscribableMixin.finishRoutine(result);
    return result;
  }

  protected invalidateRoutine(): void {
    this.dependentMixin.invalidateRoutine();
    this.subscribableMixin.invalidateRoutine();
    this.emitterMixin.invalidateRoutine();
  }

  protected deleteRoutine(): void {
    this.dependentMixin.deleteRoutine();
    this.subscribableMixin.deleteRoutine();
    this.emitterMixin.resetRoutine();
  }

  protected onStateChange(from: StateNotDeleted, to: StateNotCreating): void {}

  responseEqual(a: PoolResult<Req, Res>, b: PoolResult<Req, Res>): boolean {
    return a.strictContentEquals(b);
  }

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

  onEntryFinish(result: VersionedComputationResult<undefined>) {
    if (this.isDeleting()) return;
    this.entryData = result.result;
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

    if (reachable) {
      this.react();
    }
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

  private lastMapSeen: ReadonlySnapshotHashMap<
    Req,
    ComputationResult<Res>
  > | null = null;

  private lastEntryData: ComputationResult<undefined> = ok(undefined);

  // React to possible changes
  private react() {
    const { entryData, lastEntryData, lastMapSeen } = this;
    if (
      this.isDone() &&
      (lastMapSeen == null /* If first time */ ||
        !resultStrictEqual(lastEntryData, entryData) ||
        lastMapSeen.didChange())
    ) {
      this.lastEntryData = entryData;
      this.lastMapSeen = this.data.reachable.results.getSnapshot();
      this.emitterMixin.done(
        this.emitRunId,
        entryData.ok ? ok(this.lastMapSeen) : entryData
      );
    }
  }
}
