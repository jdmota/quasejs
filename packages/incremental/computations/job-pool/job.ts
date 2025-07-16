import {
  ComputationRegistry,
  ComputationDescription,
} from "../../incremental-lib";
import {
  ComputationResult,
  VersionedComputationResult,
} from "../../utils/result";
import { ChildComputation, ChildComputationMixin } from "../mixins/child";
import {
  DependentComputation,
  DependentComputationMixin,
} from "../mixins/dependent";
import {
  ParentComputation,
  ParentComputationMixin,
  ParentContext,
} from "../mixins/parent";
import {
  State,
  RunId,
  StateNotDeleted,
  StateNotCreating,
  RawComputation,
  AnyRawComputation,
} from "../raw";
import { ComputationPool } from "./pool";
import {
  ReachableComputation,
  ReachableComputationMixin,
} from "../mixins/reachable";
import { ComputationEntryJob } from "./entry-job";
import { BasicComputationContext } from "../basic";
import { CacheableComputationMixin } from "../mixins/cacheable";

export class ComputationJobDescription<Req, Res>
  implements ComputationDescription<ComputationJob<Req, Res>>
{
  private readonly request: Req;
  private readonly source: ComputationPool<Req, Res>;

  constructor(request: Req, source: ComputationPool<Req, Res>) {
    this.request = request;
    this.source = source;
  }

  create(registry: ComputationRegistry): ComputationJob<Req, Res> {
    return new ComputationJob(registry, this, this.request, this.source);
  }

  equal<O extends AnyRawComputation>(other: ComputationDescription<O>) {
    return (
      other instanceof ComputationJobDescription &&
      this.source === other.source &&
      this.source.config.requestDef.equal(this.request, other.request)
    );
  }

  hash() {
    return this.source.config.requestDef.hash(this.request);
  }
}

export type ComputationJobContext<Req> = BasicComputationContext<Req> &
  ParentContext<Req>;

class ComputationJob<Req, Res>
  extends RawComputation<ComputationJobContext<Req>, Res>
  implements
    DependentComputation,
    ParentComputation,
    ChildComputation,
    ReachableComputation
{
  private readonly pool: ComputationPool<Req, Res>;
  public readonly request: Req;
  public readonly dependentMixin: DependentComputationMixin;
  public readonly parentMixin: ParentComputationMixin;
  public readonly childMixin: ChildComputationMixin;
  public readonly reachableMixin: ReachableComputationMixin;
  public readonly cacheableMixin: CacheableComputationMixin<
    ComputationJob<Req, Res>
  >;

  constructor(
    registry: ComputationRegistry,
    desc: ComputationDescription<any>,
    request: Req,
    pool: ComputationPool<Req, Res>
  ) {
    super(registry, desc, false);
    this.pool = pool;
    this.request = request;
    this.dependentMixin = new DependentComputationMixin(this);
    this.parentMixin = new ParentComputationMixin(this);
    this.childMixin = new ChildComputationMixin(this);
    this.reachableMixin = new ReachableComputationMixin(this);
    this.cacheableMixin = new CacheableComputationMixin(this, desc);
    this.mark(State.PENDING);
  }

  protected exec(
    ctx: ComputationJobContext<Req>
  ): Promise<ComputationResult<Res>> {
    return this.cacheableMixin.exec(this.pool.config.exec, ctx);
  }

  protected makeContext(runId: RunId): ComputationJobContext<Req> {
    return this.registry.fs.extend({
      request: this.request,
      checkActive: () => this.checkActive(runId),
      compute: req => this.parentMixin.compute(this.pool.make(req), runId),
      ...this.dependentMixin.makeContextRoutine(runId),
    });
  }

  protected isOrphan(): boolean {
    return !this.reachableMixin.isReachable();
  }

  protected finishRoutine(result: VersionedComputationResult<Res>): void {
    this.cacheableMixin.finishRoutine(result);
    this.reachableMixin.finishOrDeleteRoutine();
    this.pool.onFieldFinish(
      this.reachableMixin.isReachable(),
      this.request,
      result
    );
  }

  protected invalidateRoutine(): void {
    this.dependentMixin.invalidateRoutine();
    this.parentMixin.invalidateRoutine();
    this.cacheableMixin.invalidateRoutine();
  }

  protected deleteRoutine(): void {
    this.dependentMixin.deleteRoutine();
    this.parentMixin.deleteRoutine();
    this.cacheableMixin.deleteRoutine();
    this.reachableMixin.finishOrDeleteRoutine();
    this.pool.onFieldDeleted(this.reachableMixin.isReachable(), this.request);
  }

  override onInEdgeAddition(node: AnyRawComputation): void {
    if (node instanceof ComputationJob || node instanceof ComputationEntryJob) {
      this.reachableMixin.onInEdgeAdditionRoutine(node.reachableMixin);
    }
  }

  override onInEdgeRemoval(node: AnyRawComputation): void {
    if (node instanceof ComputationJob || node instanceof ComputationEntryJob) {
      this.reachableMixin.onInEdgeRemovalRoutine(node.reachableMixin);
    }
  }

  protected onStateChange(from: StateNotDeleted, to: StateNotCreating): void {
    this.pool.onFieldStateChange(this.reachableMixin.isReachable(), from, to);
  }

  onReachabilityChange(from: boolean, to: boolean): void {
    this.pool.onFieldReachabilityChange(
      this.getState(),
      this.request,
      from,
      to
    );
  }
}
