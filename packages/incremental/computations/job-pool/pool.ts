import { createNotifier, Notifier } from "../../../util/deferred";
import { LinkedList } from "../../../util/data-structures/linked-list";
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
  MapEvent,
} from "../../utils/hash-map";
import { ComputationResult, resultEqual, ok } from "../../utils/result";
import { ComputationJobContext, ComputationJobDescription } from "./job";
import {
  ComputationEntryJobContext,
  ComputationEntryJobDescription,
} from "./entry-job";
import {
  EmitterComputation,
  EmitterComputationMixin,
  EmitterContext,
} from "../mixins/events/emitter";

type ComputationPoolEvent<Req, Res> =
  | MapEvent<Req, ComputationResult<Res>>
  | {
      readonly type: "done";
      readonly map: ReadonlySnapshotHashMap<Req, ComputationResult<Res>>;
    };

class ObservableHashMap<K, V> extends HashMap<K, V> {
  private readonly fn: (event: MapEvent<K, V>) => void;

  constructor(
    valueDef: ValueDefinition<K>,
    fn: (event: MapEvent<K, V>) => void
  ) {
    super(valueDef);
    this.fn = fn;
  }

  protected override changed(event: MapEvent<K, V>): void {
    super.changed(event);
    const { fn } = this;
    fn(event);
  }
}

type ComputationPoolContext<Req, Res> = {
  readonly checkActive: () => void;
  readonly get: <T>(
    dep: ComputationDescription<
      RawComputation<any, T> & SubscribableComputation<T>
    >
  ) => Promise<ComputationResult<T>>;
} & EmitterContext<ComputationPoolEvent<Req, Res>>;

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

class ComputationPoolDescription<Req, Res>
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
    ComputationPoolContext<Req, Res>,
    ReadonlySnapshotHashMap<Req, ComputationResult<Res>>
  >
  implements
    DependentComputation,
    SubscribableComputation<
      ReadonlySnapshotHashMap<Req, ComputationResult<Res>>
    >,
    EmitterComputation<ComputationPoolEvent<Req, Res>>
{
  public readonly dependentMixin: DependentComputationMixin;
  public readonly subscribableMixin: SubscribableComputationMixin<
    ReadonlySnapshotHashMap<Req, ComputationResult<Res>>
  >;
  public readonly emitterMixin: EmitterComputationMixin<
    ComputationPoolEvent<Req, Res>
  >;
  //
  public readonly config: ComputationPoolConfig<Req, Res>;
  private readonly entryDescription: ComputationEntryJobDescription<Req, Res>;
  private readonly data: {
    readonly reachable: {
      results: ObservableHashMap<Req, ComputationResult<Res>>;
      status: [number, number, number, number];
    };
    readonly unreachable: {
      results: HashMap<Req, ComputationResult<Res>>;
      status: [number, number, number, number];
    };
  };
  private readonly notifier: Notifier<null>;
  private lastSeen: ReadonlySnapshotHashMap<Req, ComputationResult<Res>> | null;
  private readonly equal: (
    a: ComputationResult<Res>,
    b: ComputationResult<Res>
  ) => boolean;

  constructor(
    registry: ComputationRegistry,
    desc: ComputationPoolDescription<Req, Res>
  ) {
    super(registry, desc, false);
    this.dependentMixin = new DependentComputationMixin(this);
    this.subscribableMixin = new SubscribableComputationMixin(this);
    this.emitterMixin = new EmitterComputationMixin(this);
    this.config = desc.config;
    this.entryDescription = new ComputationEntryJobDescription(this);
    this.data = {
      reachable: {
        results: new ObservableHashMap<Req, ComputationResult<Res>>(
          desc.config.requestDef,
          e => this.emit(e)
        ),
        status: [0, 0, 0, 0],
      },
      unreachable: {
        results: new HashMap<Req, ComputationResult<Res>>(
          desc.config.requestDef
        ),
        status: [0, 0, 0, 0],
      },
    };
    this.notifier = createNotifier();
    this.lastSeen = null;
    this.equal = (a, b) => resultEqual(desc.config.responseDef.equal, a, b);
    this.mark(State.PENDING);
  }

  protected async exec(
    ctx: ComputationPoolContext<Req, Res>
  ): Promise<
    ComputationResult<ReadonlySnapshotHashMap<Req, ComputationResult<Res>>>
  > {
    // Wait for the entry computation to finish
    const startResult = await ctx.get(this.entryDescription);

    if (!startResult.ok) {
      return startResult;
    }

    // Wait for all children computations to finish
    while (!this.isDone()) {
      // Ensure this running version is active before doing side-effects
      ctx.checkActive();
      await this.notifier.wait();
      // In case invalidations occured between notifier.done()
      // and this computation resuming, keep waiting if !isDone()
    }

    ctx.checkActive();
    // Record the last seen version of the results map
    // in the same tick when isDone()
    this.lastSeen = this.data.reachable.results.getSnapshot();
    this.emit({
      type: "done",
      map: this.lastSeen,
    });
    return ok(this.lastSeen);
  }

  protected makeContext(runId: RunId): ComputationPoolContext<Req, Res> {
    return {
      checkActive: () => this.checkActive(runId),
      ...this.dependentMixin.makeContextRoutine(runId),
      ...this.emitterMixin.makeContextRoutine(),
    };
  }

  protected isOrphan(): boolean {
    return this.subscribableMixin.isOrphan() && this.emitterMixin.isOrphan();
  }

  protected finishRoutine(
    result: ComputationResult<
      ReadonlySnapshotHashMap<Req, ComputationResult<Res>>
    >
  ): void {
    this.subscribableMixin.finishRoutine(result);
  }

  protected invalidateRoutine(): void {
    this.dependentMixin.invalidateRoutine();
    this.subscribableMixin.invalidateRoutine();
  }

  protected deleteRoutine(): void {
    this.dependentMixin.deleteRoutine();
    this.subscribableMixin.deleteRoutine();
    this.emitterMixin.deleteRoutine();
  }

  protected onStateChange(from: StateNotDeleted, to: StateNotCreating): void {
    // Upon invalidation, undo the effects
    if (to === State.PENDING || to === State.DELETED) {
      this.lastSeen = null;
      this.notifier.cancel();
    }
  }

  responseEqual(
    a: ReadonlySnapshotHashMap<Req, ComputationResult<Res>>,
    b: ReadonlySnapshotHashMap<Req, ComputationResult<Res>>
  ): boolean {
    return false;
  }

  onNewResult(
    result: ComputationResult<
      ReadonlySnapshotHashMap<Req, ComputationResult<Res>>
    >
  ): void {}

  make(request: Req) {
    return this.registry.make(new ComputationJobDescription(request, this));
  }

  private isDone() {
    const status = this.data.reachable.status;
    return status[State.PENDING] + status[State.RUNNING] === 0;
  }

  onFieldFinish(
    reachable: boolean,
    req: Req,
    result: ComputationResult<Res>
  ): void {
    if (this.isDeleting()) return;
    const map = reachable
      ? this.data.reachable.results
      : this.data.unreachable.results;
    map.set(req, result, this.equal);
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

  // React to possible changes
  private react() {
    if (this.lastSeen?.didChange()) {
      this.invalidate();
    }

    if (this.isDone()) {
      this.notifier.done(null);
    }
  }

  // Event emitter stuff

  private readonly pastEvents = new LinkedList<
    ComputationPoolEvent<Req, Res>
  >();

  getAllPastEvents(): IterableIterator<ComputationPoolEvent<Req, Res>> {
    return this.pastEvents[Symbol.iterator]();
  }

  private emit(event: ComputationPoolEvent<Req, Res>) {
    if (event.type === "done") {
      this.pastEvents.clear();
    }
    this.pastEvents.addLast(event);
    this.emitterMixin.emit(event);
  }

  // TODO map and filter operations
}
