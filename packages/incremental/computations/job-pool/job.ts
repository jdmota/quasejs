import { ComputationRegistry } from "../../incremental-lib";
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
  StateNotDeleted,
  StateNotCreating,
  RawComputation,
  AnyRawComputation,
} from "../raw";
import { ComputationDescription } from "../description";
import { ComputationPool, ComputationPoolDescription } from "./pool";
import {
  ReachableComputation,
  ReachableComputationMixin,
} from "../mixins/reachable";
import { BasicComputationContext } from "../basic";
import { CacheableComputationMixin } from "../mixins/cacheable";
import {
  SubscribableComputation,
  SubscribableComputationMixin,
} from "../mixins/subscribable";
import { serializationDB } from "../../utils/serialization-db";

type ComputationJobDescriptionJSON<Req, Res> = {
  readonly request: Req;
  readonly poolDesc: ComputationPoolDescription<Req, Res>;
};

export class ComputationJobDescription<Req, Res> extends ComputationDescription<
  ComputationJob<Req, Res>
> {
  public readonly request: Req;
  public readonly poolDesc: ComputationPoolDescription<Req, Res>;

  constructor(request: Req, poolDesc: ComputationPoolDescription<Req, Res>) {
    super();
    this.request = request;
    this.poolDesc = poolDesc;
  }

  create(registry: ComputationRegistry): ComputationJob<Req, Res> {
    return new ComputationJob(
      registry,
      this,
      this.request,
      registry.make(this.poolDesc)
    );
  }

  equal<O extends AnyRawComputation>(other: ComputationDescription<O>) {
    return (
      other instanceof ComputationJobDescription &&
      this.poolDesc.equal(other.poolDesc) &&
      this.poolDesc.config.requestDef.equal(this.request, other.request)
    );
  }

  hash() {
    return this.poolDesc.config.requestDef.hash(this.request);
  }

  getCacheKey() {
    return `PoolJob{${this.poolDesc.getCacheKey()},${this.poolDesc.config.requestDef.hash(this.request)}}`;
  }
}

serializationDB.register<
  ComputationJobDescription<any, any>,
  ComputationJobDescriptionJSON<any, any>
>(ComputationJobDescription, {
  name: "ComputationJobDescription",
  serialize(value) {
    return {
      poolDesc: value.poolDesc,
      request: value.request,
    };
  },
  deserialize(out) {
    return new ComputationJobDescription(out.request, out.poolDesc);
  },
});

export type ComputationJobContext<Req> = BasicComputationContext<Req> &
  ParentContext<Req>;

class ComputationJob<Req, Res>
  extends RawComputation<ComputationJobContext<Req>, Res>
  implements
    SubscribableComputation<Res>,
    DependentComputation,
    ParentComputation,
    ChildComputation,
    ReachableComputation
{
  private readonly pool: ComputationPool<Req, Res>;
  public readonly request: Req;
  public readonly subscribableMixin: SubscribableComputationMixin<Res>;
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
    super(registry, desc);
    this.pool = pool;
    this.request = request;
    this.subscribableMixin = new SubscribableComputationMixin(this);
    this.dependentMixin = new DependentComputationMixin(this);
    this.parentMixin = new ParentComputationMixin(this);
    this.childMixin = new ChildComputationMixin(this);
    this.reachableMixin = new ReachableComputationMixin(this);
    this.cacheableMixin = new CacheableComputationMixin(this, desc);
  }

  protected exec(
    ctx: ComputationJobContext<Req>,
    runId: number
  ): Promise<ComputationResult<Res>> {
    return this.cacheableMixin.exec(this.pool.config.exec, ctx, runId);
  }

  protected makeContext(runId: number): ComputationJobContext<Req> {
    return this.registry.fs.extend({
      request: this.request,
      checkActive: () => this.checkActive(runId),
      compute: req => this.parentMixin.compute(this.pool.make(req), runId),
      ...this.dependentMixin.makeContextRoutine(runId),
    });
  }

  protected isOrphan(): boolean {
    return (
      this.subscribableMixin.isOrphan() && !this.reachableMixin.isReachable()
    );
  }

  protected finishRoutine(result: VersionedComputationResult<Res>) {
    result = this.subscribableMixin.finishRoutine(result);
    result = this.cacheableMixin.finishRoutine(result, true);
    this.reachableMixin.finishOrDeleteRoutine();
    this.pool.onFieldFinish(
      this.reachableMixin.isReachable(),
      this.request,
      result
    );
    return result;
  }

  protected invalidateRoutine(): void {
    this.subscribableMixin.invalidateRoutine();
    this.dependentMixin.invalidateRoutine();
    this.parentMixin.invalidateRoutine();
    this.cacheableMixin.invalidateRoutine();
  }

  protected deleteRoutine(): void {
    this.subscribableMixin.deleteRoutine();
    this.dependentMixin.deleteRoutine();
    this.parentMixin.deleteRoutine();
    this.cacheableMixin.deleteRoutine();
    this.reachableMixin.finishOrDeleteRoutine();
    this.pool.onFieldDeleted(this.reachableMixin.isReachable(), this.request);
  }

  onInEdgeAddition(node: ParentComputation): void {
    this.reachableMixin.onInEdgeAdditionRoutine(node.reachableMixin);
  }

  onInEdgeRemoval(node: ParentComputation): void {
    this.reachableMixin.onInEdgeRemovalRoutine(node.reachableMixin);
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

  responseEqual(a: Res, b: Res): boolean {
    return this.pool.config.responseDef.equal(a, b);
  }
}
