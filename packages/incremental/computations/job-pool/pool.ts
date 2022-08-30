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
import { Notifier, createNotifier } from "../../utils/deferred";
import {
  ValueDefinition,
  ReadonlyHandlerHashMap,
  HashMap,
} from "../../utils/hash-map";
import { Result, resultEqual, ok } from "../../utils/result";
import { ComputationJobContext, ComputationJobDescription } from "./job";
import {
  ComputationEntryJobContext,
  ComputationEntryJobDescription,
} from "./entry-job";

type ComputationMapContext<Req> = {
  readonly checkActive: () => void;
  readonly get: <T>(
    dep: ComputationDescription<
      RawComputation<any, T> & SubscribableComputation<T>
    >
  ) => Promise<Result<T>>;
};

type ComputationExec<Ctx, Res> = (ctx: Ctx) => Promise<Result<Res>>;

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
    return new ComputationPool(registry, this, this.config);
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
    ComputationMapContext<Req>,
    ReadonlyHandlerHashMap<Req, Result<Res>>
  >
  implements
    DependentComputation,
    SubscribableComputation<ReadonlyHandlerHashMap<Req, Result<Res>>>
{
  public readonly dependentMixin: DependentComputationMixin;
  public readonly subscribableMixin: SubscribableComputationMixin<
    ReadonlyHandlerHashMap<Req, Result<Res>>
  >;
  //
  public readonly config: ComputationPoolConfig<Req, Res>;
  private readonly entryDescription: ComputationEntryJobDescription<Req, Res>;
  private readonly data: {
    readonly reachable: {
      results: HashMap<Req, Result<Res>>;
      status: [number, number, number, number];
    };
    readonly unreachable: {
      results: HashMap<Req, Result<Res>>;
      status: [number, number, number, number];
    };
  };
  private readonly notifier: Notifier<null>;
  private lastSeen: ReadonlyHandlerHashMap<Req, Result<Res>> | null;
  private readonly equal: (a: Result<Res>, b: Result<Res>) => boolean;

  constructor(
    registry: ComputationRegistry,
    description: ComputationDescription<any>,
    config: ComputationPoolConfig<Req, Res>
  ) {
    super(registry, description, false);
    this.dependentMixin = new DependentComputationMixin(this);
    this.subscribableMixin = new SubscribableComputationMixin(this);
    this.config = config;
    this.entryDescription = new ComputationEntryJobDescription(this);
    this.data = {
      reachable: {
        results: new HashMap<Req, Result<Res>>(config.requestDef),
        status: [0, 0, 0, 0],
      },
      unreachable: {
        results: new HashMap<Req, Result<Res>>(config.requestDef),
        status: [0, 0, 0, 0],
      },
    };
    this.notifier = createNotifier();
    this.lastSeen = null;
    this.equal = (a, b) => resultEqual(config.responseDef.equal, a, b);
    this.mark(State.PENDING);
  }

  protected async exec(
    ctx: ComputationMapContext<Req>
  ): Promise<Result<ReadonlyHandlerHashMap<Req, Result<Res>>>> {
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
    return ok(this.lastSeen);
  }

  protected makeContext(runId: RunId): ComputationMapContext<Req> {
    return {
      checkActive: () => this.checkActive(runId),
      ...this.dependentMixin.makeContextRoutine(runId),
    };
  }

  protected isOrphan(): boolean {
    return this.subscribableMixin.isOrphan();
  }

  protected finishRoutine(
    result: Result<ReadonlyHandlerHashMap<Req, Result<Res>>>
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
    return this.registry.make(new ComputationJobDescription(request, this));
  }

  private isDone() {
    const status = this.data.reachable.status;
    return status[State.PENDING] + status[State.RUNNING] === 0;
  }

  onFieldFinish(reachable: boolean, req: Req, result: Result<Res>): void {
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

  // TODO map and filter operations
}
