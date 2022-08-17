import {
  ComputationRegistry,
  ComputationDescription,
} from "../incremental-lib";
import { Notifier, createNotifier } from "../utils/deferred";
import {
  ValueDefinition,
  ReadonlyHandlerHashMap,
  HashMap,
} from "../utils/hash-map";
import { ok, Result, resultEqual } from "../utils/result";
import { ChildComputation, ChildComputationMixin } from "./child";
import { DependentComputation, DependentComputationMixin } from "./dependent";
import { ParentComputation, ParentComputationMixin } from "./parent";
import {
  SubscribableComputation,
  SubscribableComputationMixin,
} from "./subscribable";
import {
  State,
  RunId,
  StateNotDeleted,
  StateNotCreating,
  AnyRawComputation,
  RawComputation,
} from "./raw";

type ComputationMapStartContext<Req> = {
  readonly get: <T>(dep: SubscribableComputation<T>) => Promise<Result<T>>;
  readonly compute: (req: Req) => void;
};

type ComputationMapFieldContext<Req> = {
  readonly get: <T>(dep: SubscribableComputation<T>) => Promise<Result<T>>;
  readonly compute: (req: Req) => void;
  readonly request: Req;
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
  readonly exec: ComputationExec<ComputationMapFieldContext<Req>, Res>;
  readonly requestDef: ValueDefinition<Req>;
  readonly responseDef: ValueDefinition<Res>;
};

class ComputationMapField<Req, Res>
  extends RawComputation<ComputationMapFieldContext<Req>, Res>
  implements DependentComputation, ParentComputation, ChildComputation
{
  private readonly source: ComputationMap<Req, Res>;
  public readonly request: Req;
  public readonly dependentMixin: DependentComputationMixin;
  public readonly parentMixin: ParentComputationMixin;
  public readonly childrenMixin: ChildComputationMixin;

  constructor(
    registry: ComputationRegistry,
    description: ComputationDescription<any>,
    request: Req,
    source: ComputationMap<Req, Res>
  ) {
    super(registry, description, false);
    this.source = source;
    this.request = request;
    this.dependentMixin = new DependentComputationMixin(this);
    this.parentMixin = new ParentComputationMixin(this);
    this.childrenMixin = new ChildComputationMixin(this);
    this.mark(State.PENDING);
  }

  protected exec(ctx: ComputationMapFieldContext<Req>): Promise<Result<Res>> {
    return this.source.execField(ctx);
  }

  protected makeContext(runId: RunId): ComputationMapFieldContext<Req> {
    return {
      get: dep => this.dependentMixin.getDep(dep, runId),
      compute: req => this.parentMixin.compute(this.source.make(req), runId),
      request: this.request,
    };
  }

  protected isOrphan(): boolean {
    return this.childrenMixin.isOrphan();
  }

  protected finishRoutine(result: Result<Res>): void {
    this.source.onFieldFinish(this.request, result);
  }

  protected invalidateRoutine(): void {
    this.dependentMixin.invalidateRoutine();
    this.parentMixin.invalidateRoutine();
  }

  protected deleteRoutine(): void {
    this.dependentMixin.deleteRoutine();
    this.parentMixin.deleteRoutine();
    this.source.onFieldDeleted(this.request);
  }

  protected onStateChange(from: StateNotDeleted, to: StateNotCreating): void {
    this.source.onFieldStateChange(from, to);
  }
}

class ComputationMapFieldDescription<Req, Res>
  implements ComputationDescription<ComputationMapField<Req, Res>>
{
  private readonly request: Req;
  private readonly source: ComputationMap<Req, Res>;

  constructor(request: Req, source: ComputationMap<Req, Res>) {
    this.request = request;
    this.source = source;
  }

  create(registry: ComputationRegistry): ComputationMapField<Req, Res> {
    return new ComputationMapField(registry, this, this.request, this.source);
  }

  equal<O extends AnyRawComputation>(other: ComputationDescription<O>) {
    return (
      other instanceof ComputationMapFieldDescription &&
      this.source === other.source &&
      this.source.mapDefinition.requestDef.equal(this.request, other.request)
    );
  }

  hash() {
    return this.source.mapDefinition.requestDef.hash(this.request);
  }
}

export class ComputationMap<Req, Res>
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
      new ComputationMapFieldDescription(request, this)
    );
  }

  private isDone() {
    // TODO FIXME cannot rely on this! deletion happens later. how do we know the pending ones are not orphan?
    // In fact, since this will produce a graph (maybe a cyclic one)
    // How to know if some computation should still exist??
    return this.status[State.PENDING] + this.status[State.RUNNING] === 0;
  }

  async execField(ctx: ComputationMapFieldContext<Req>): Promise<Result<Res>> {
    this.inv();
    return this.mapDefinition.exec(ctx);
  }

  onFieldFinish(req: Req, result: Result<Res>): void {
    this.inv();
    this.resultsMap.set(req, result, this.equal);
  }

  onFieldDeleted(req: Req): void {
    this.inv();
    this.resultsMap.delete(req);
  }

  onFieldStateChange(from: StateNotDeleted, to: StateNotCreating): void {
    this.inv();
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
