import {
  ComputationRegistry,
  ComputationDescription,
} from "../../incremental-lib";
import {
  ComputationResult,
  VersionedComputationResult,
} from "../../utils/result";
import {
  DependentComputation,
  DependentComputationMixin,
  DependentContext,
} from "../mixins/dependent";
import {
  ParentComputation,
  ParentComputationMixin,
  ParentContext,
} from "../mixins/parent";
import {
  SubscribableComputation,
  SubscribableComputationMixin,
} from "../mixins/subscribable";
import {
  State,
  RunId,
  StateNotDeleted,
  StateNotCreating,
  RawComputation,
  AnyRawComputation,
  RawComputationContext,
} from "../raw";
import { ComputationPool } from "./pool";
import {
  ReachableComputation,
  ReachableComputationMixin,
  ReachableComputationMixinRoot,
} from "../mixins/reachable";
import { CtxWithFS } from "../file-system/file-system";
import { CacheableComputationMixin } from "../mixins/cacheable";

export class ComputationEntryJobDescription<Req, Res>
  implements ComputationDescription<ComputationEntryJob<Req, Res>>
{
  private readonly source: ComputationPool<Req, Res>;

  constructor(source: ComputationPool<Req, Res>) {
    this.source = source;
  }

  create(registry: ComputationRegistry): ComputationEntryJob<Req, Res> {
    return new ComputationEntryJob(registry, this, this.source);
  }

  equal<O extends AnyRawComputation>(other: ComputationDescription<O>) {
    return (
      other instanceof ComputationEntryJobDescription &&
      this.source === other.source
    );
  }

  hash() {
    return 0;
  }
}

export type ComputationEntryJobContext<Req> = DependentContext &
  ParentContext<Req> &
  CtxWithFS &
  RawComputationContext;

export class ComputationEntryJob<Req, Res>
  extends RawComputation<ComputationEntryJobContext<Req>, undefined>
  implements
    DependentComputation,
    SubscribableComputation<undefined>,
    ParentComputation,
    ReachableComputation
{
  private readonly pool: ComputationPool<Req, Res>;
  public readonly dependentMixin: DependentComputationMixin;
  public readonly subscribableMixin: SubscribableComputationMixin<undefined>;
  public readonly parentMixin: ParentComputationMixin;
  public readonly reachableMixin: ReachableComputationMixin;
  public readonly cacheableMixin: CacheableComputationMixin<
    ComputationEntryJob<Req, Res>
  >;

  constructor(
    registry: ComputationRegistry,
    desc: ComputationDescription<any>,
    pool: ComputationPool<Req, Res>
  ) {
    super(registry, desc, false);
    this.pool = pool;
    this.dependentMixin = new DependentComputationMixin(this);
    this.subscribableMixin = new SubscribableComputationMixin(this);
    this.parentMixin = new ParentComputationMixin(this);
    this.reachableMixin = new ReachableComputationMixinRoot(this);
    this.cacheableMixin = new CacheableComputationMixin(this, desc);
    this.mark(State.PENDING);
  }

  protected exec(
    ctx: ComputationEntryJobContext<Req>,
    runId: RunId
  ): Promise<ComputationResult<undefined>> {
    return this.cacheableMixin.exec(this.pool.config.startExec, ctx, runId);
  }

  protected makeContext(runId: RunId): ComputationEntryJobContext<Req> {
    return this.registry.fs.extend({
      checkActive: () => this.checkActive(runId),
      compute: req => this.parentMixin.compute(this.pool.make(req), runId),
      ...this.dependentMixin.makeContextRoutine(runId),
    });
  }

  protected isOrphan(): boolean {
    return this.subscribableMixin.isOrphan();
  }

  protected finishRoutine(result: VersionedComputationResult<undefined>) {
    result = this.subscribableMixin.finishRoutine(result);
    result = this.cacheableMixin.finishRoutine(result);
    this.reachableMixin.finishOrDeleteRoutine();
    return result;
  }

  protected invalidateRoutine(): void {
    this.dependentMixin.invalidateRoutine();
    this.subscribableMixin.invalidateRoutine();
    this.parentMixin.invalidateRoutine();
    this.cacheableMixin.invalidateRoutine();
  }

  protected deleteRoutine(): void {
    this.dependentMixin.deleteRoutine();
    this.subscribableMixin.deleteRoutine();
    this.parentMixin.deleteRoutine();
    this.cacheableMixin.deleteRoutine();
    this.reachableMixin.finishOrDeleteRoutine();
  }

  protected onStateChange(from: StateNotDeleted, to: StateNotCreating): void {
    this.pool.onEntryStateChange(from, to);
  }

  onReachabilityChange(from: boolean, to: boolean): void {}

  onNewResult(result: VersionedComputationResult<undefined>): void {}
}
