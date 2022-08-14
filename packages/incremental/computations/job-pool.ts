import {
  Result,
  ComputationRegistry,
  ComputationDescription,
  ok,
} from "../incremental-lib";
import { Notifier, createNotifier } from "../utils/deferred";
import {
  ValueDefinition,
  ReadonlyHandlerHashMap,
  HashMap,
} from "../utils/hash-map";
import {
  State,
  RunId,
  StateNotDeleted,
  StateNotCreating,
  AnyRawComputation,
} from "./raw";
import { Computation, AnyComputation } from "./subscribable";
import {
  ComputationWithChildren,
  AnyComputationWithChildren,
} from "./with-children";

type ComputationMapStartContext<Req> = {
  readonly get: <T>(dep: Computation<any, any, T>) => Promise<Result<T>>;
  readonly compute: (req: Req) => void;
};

type ComputationMapFieldContext<Req> = {
  readonly get: <T>(dep: Computation<any, any, T>) => Promise<Result<T>>;
  readonly compute: (req: Req) => void;
  readonly request: Req;
};

type ComputationMapContext<Req> = {
  readonly active: () => void;
  readonly get: <T>(dep: Computation<any, any, T>) => Promise<Result<T>>;
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

class ComputationMapField<Req, Res> extends ComputationWithChildren<
  ComputationMapFieldContext<Req>,
  Req,
  Res
> {
  private readonly source: ComputationMap<Req, Res>;

  constructor(
    registry: ComputationRegistry,
    description: ComputationDescription<any>,
    request: Req,
    source: ComputationMap<Req, Res>
  ) {
    super(registry, description, request, false);
    this.source = source;
    this.mark(State.PENDING);
  }

  override subscribe(dep: AnyComputation): void {
    // TODO split two kinds of computations
    throw new Error("Cannot subscribe to this kind of computation");
  }

  protected override responseEqual(a: Res, b: Res): boolean {
    return this.source.mapDefinition.responseDef.equal(a, b);
  }

  protected exec(ctx: ComputationMapFieldContext<Req>): Promise<Result<Res>> {
    return this.source.execField(ctx);
  }

  protected makeContext(runId: RunId): ComputationMapFieldContext<Req> {
    return {
      get: dep => this.getDep(dep, runId),
      compute: req => this.compute(this.source.make(req), runId),
      request: this.request,
    };
  }

  protected override onFinishNew(result: Result<Res>): void {
    super.onFinishNew(result);
    this.source.onFieldFinishNew(this.request, result);
  }

  protected override onDeleted(): void {
    super.onDeleted();
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

export class ComputationMap<Req, Res> extends ComputationWithChildren<
  ComputationMapContext<Req>,
  undefined,
  ReadonlyHandlerHashMap<Req, Result<Res>>
> {
  public readonly mapDefinition: ComputationMapDefinition<Req, Res>;
  private readonly resultsMap: HashMap<Req, Result<Res>>;
  private readonly status: [number, number, number, number];
  private readonly notifier: Notifier<null>;
  private lastSeen: ReadonlyHandlerHashMap<Req, Result<Res>> | null;

  constructor(
    registry: ComputationRegistry,
    description: ComputationDescription<any>,
    mapDefinition: ComputationMapDefinition<Req, Res>
  ) {
    super(registry, description, undefined, false);
    this.mapDefinition = mapDefinition;
    this.resultsMap = new HashMap<Req, Result<Res>>(mapDefinition.requestDef);
    this.status = [0, 0, 0, 0];
    this.notifier = createNotifier();
    this.lastSeen = null;
    this.mark(State.PENDING);
  }

  protected override responseEqual(
    a: ReadonlyHandlerHashMap<Req, Result<Res>>,
    b: ReadonlyHandlerHashMap<Req, Result<Res>>
  ): boolean {
    return false;
  }

  make(request: Req): AnyComputationWithChildren {
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
      get: dep => this.getDep(dep, runId),
      compute: req => this.compute(this.make(req), runId),
    };
  }

  protected onStateChange(from: StateNotDeleted, to: StateNotCreating): void {
    // Upon invalidation, undo the effects
    if (to === State.PENDING || to === State.DELETED) {
      this.lastSeen = null;
      this.notifier.cancel();
    }
  }

  async execField(ctx: ComputationMapFieldContext<Req>): Promise<Result<Res>> {
    this.inv();
    return this.mapDefinition.exec(ctx);
  }

  onFieldFinishNew(req: Req, result: Result<Res>): void {
    this.inv();
    this.resultsMap.set(req, result);
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
