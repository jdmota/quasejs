import {
  DependentComputation,
  DependentComputationMixin,
} from "../computations/dependent";
import {
  ParentComputation,
  ParentComputationMixin,
} from "../computations/parent";
import {
  RawComputation,
  State,
  RunId,
  StateNotDeleted,
  StateNotCreating,
} from "../computations/raw";
import {
  SubscribableComputation,
  SubscribableComputationMixin,
} from "../computations/subscribable";
import {
  ComputationDescription,
  ComputationRegistry,
} from "../incremental-lib";
import { Notifier, createNotifier } from "../utils/deferred";
import {
  ValueDefinition,
  ReadonlyHandlerHashMap,
  HashMap,
} from "../utils/hash-map";
import { Result, resultEqual, ok } from "../utils/result";
import {
  ComputationJobInPoolContext,
  ComputationJobInPoolDescription,
} from "./job";

type ComputationMapStartContext<Req> = {
  readonly get: <T>(dep: SubscribableComputation<T>) => Promise<Result<T>>;
  readonly compute: (req: Req) => void;
};

type ComputationMapContext<Req> = {
  readonly active: () => void;
  readonly get: <T>(dep: SubscribableComputation<T>) => Promise<Result<T>>;
  readonly compute: (dep: Req) => void;
};

type ComputationExec<Ctx, Res> = (ctx: Ctx) => Promise<Result<Res>>;

export type ComputationMapDefinition<Req, Res> = {
  readonly startExec: ComputationExec<
    ComputationMapStartContext<Req>,
    undefined
  >;
  readonly exec: ComputationExec<ComputationJobInPoolContext<Req>, Res>;
  readonly requestDef: ValueDefinition<Req>;
  readonly responseDef: ValueDefinition<Res>;
};

export class ComputationPool<Req, Res>
  extends RawComputation<
    ComputationMapContext<Req>,
    ReadonlyHandlerHashMap<Req, Result<Res>>
  >
  implements
    DependentComputation,
    SubscribableComputation<ReadonlyHandlerHashMap<Req, Result<Res>>>,
    ParentComputation
{
  public readonly dependentMixin: DependentComputationMixin;
  public readonly subscribableMixin: SubscribableComputationMixin<
    ReadonlyHandlerHashMap<Req, Result<Res>>
  >;
  public readonly parentMixin: ParentComputationMixin;

  public readonly mapDefinition: ComputationMapDefinition<Req, Res>;
  private readonly resultsMap: HashMap<Req, Result<Res>>;
  private readonly status: [number, number, number, number];
  private readonly notifier: Notifier<null>;
  private lastSeen: ReadonlyHandlerHashMap<Req, Result<Res>> | null;
  private readonly equal: (a: Result<Res>, b: Result<Res>) => boolean;

  constructor(
    registry: ComputationRegistry,
    description: ComputationDescription<any>,
    mapDefinition: ComputationMapDefinition<Req, Res>
  ) {
    super(registry, description, false);
    this.dependentMixin = new DependentComputationMixin(this);
    this.subscribableMixin = new SubscribableComputationMixin(this);
    this.parentMixin = new ParentComputationMixin(this);
    this.mapDefinition = mapDefinition;
    this.resultsMap = new HashMap<Req, Result<Res>>(mapDefinition.requestDef);
    this.status = [0, 0, 0, 0];
    this.notifier = createNotifier();
    this.lastSeen = null;
    this.equal = (a, b) => resultEqual(mapDefinition.responseDef.equal, a, b);
    this.mark(State.PENDING);
  }

  protected async exec(
    ctx: ComputationMapContext<Req>
  ): Promise<Result<ReadonlyHandlerHashMap<Req, Result<Res>>>> {
    const { startExec } = this.mapDefinition;

    // Wait for the start computation to finish
    const startResult = await startExec({
      get: ctx.get,
      compute: ctx.compute,
    });

    if (!startResult.ok) {
      return startResult;
    }

    // Wait for all children computations to finish
    while (!this.isDone()) {
      // Ensure this running version is active before doing side-effects
      ctx.active();
      await this.notifier.wait();
      // In case invalidations occured between notifier.done()
      // and this computation resuming, keep waiting if !isDone()
    }

    ctx.active();
    // Record the last seen version of the results map
    // in the same tick when isDone()
    this.lastSeen = this.resultsMap.getSnapshot();
    return ok(this.lastSeen);
  }

  protected makeContext(runId: RunId): ComputationMapContext<Req> {
    return {
      active: () => this.active(runId),
      get: dep => this.dependentMixin.getDep(dep, runId),
      compute: req => this.parentMixin.compute(this.make(req), runId),
    };
  }

  protected isOrphan(): boolean {
    return this.subscribableMixin.isOrphan();
  }

  protected finishRoutine(
    result: Result<ReadonlyHandlerHashMap<Req, Result<Res>>>
  ): void {
    // this.dependentMixin.finishRoutine(result);
    this.subscribableMixin.finishRoutine(result);
    // this.parentMixin.finishRoutine(result);
  }

  protected invalidateRoutine(): void {
    this.dependentMixin.invalidateRoutine();
    this.subscribableMixin.invalidateRoutine();
    this.parentMixin.invalidateRoutine();
  }

  protected deleteRoutine(): void {
    this.dependentMixin.deleteRoutine();
    this.subscribableMixin.deleteRoutine();
    this.parentMixin.deleteRoutine();
  }

  protected onStateChange(from: StateNotDeleted, to: StateNotCreating): void {
    // Upon invalidation, undo the effects
    if (to === State.PENDING || to === State.DELETED) {
      this.lastSeen = null;
      this.notifier.cancel();
    }
  }

  responseEqual(
    a: ReadonlyHandlerHashMap<Req, Result<Res>>,
    b: ReadonlyHandlerHashMap<Req, Result<Res>>
  ): boolean {
    return false;
  }

  onNewResult(result: Result<ReadonlyHandlerHashMap<Req, Result<Res>>>): void {}

  make(request: Req) {
    return this.registry.make(
      new ComputationJobInPoolDescription(request, this)
    );
  }

  // TODO when we remove an edge from A to B, we need to do a search backwards to find the root
  // If we find the root, all fine
  // If we do not find the root, all the nodes we saw backwards are also not reachable
  // (if we start with a graph where all the nodes are reachable from a root/source,
  // the nodes that we found by going backwards, which are no longer reachable,
  // were reachable before only because of the edge that was just removed)
  // In that case, we can remove all these nodes
  // By removing all these nodes, other edges will be broken, so we need to repeat the steps

  // TODO what if an edge is removed and then added again?

  // TODO should this computation have mini-registry stored?

  private isDone() {
    // TODO FIXME cannot rely on this! deletion happens later. how do we know the pending ones are not orphan?
    // In fact, since this will produce a graph (maybe a cyclic one)
    // How to know if some computation should still exist??
    return this.status[State.PENDING] + this.status[State.RUNNING] === 0;
  }

  onFieldFinish(req: Req, result: Result<Res>): void {
    if (this.deleted()) return;
    this.resultsMap.set(req, result, this.equal);
  }

  onFieldDeleted(req: Req): void {
    if (this.deleted()) return;
    this.resultsMap.delete(req);
  }

  onFieldStateChange(from: StateNotDeleted, to: StateNotCreating): void {
    if (this.deleted()) return;

    if (from !== State.CREATING) {
      this.status[from]--;
    }
    if (to !== State.DELETED) {
      this.status[to]++;
    }

    // React to changes
    if (this.lastSeen?.didChange()) {
      this.invalidate();
    }

    if (this.isDone()) {
      this.notifier.done(null);
    }
  }

  // TODO map and filter operations
}
