import { type ComputationRegistry } from "../../incremental-lib";
import {
  type ComputationResult,
  type VersionedComputationResult,
} from "../../utils/result";
import {
  type DependentComputation,
  DependentComputationMixin,
  type DependentContext,
} from "../mixins/dependent";
import {
  type ParentComputation,
  ParentComputationMixin,
  type ParentContext,
} from "../mixins/parent";
import {
  type SubscribableComputation,
  SubscribableComputationMixin,
} from "../mixins/subscribable";
import {
  type StateNotDeleted,
  type StateNotCreating,
  RawComputation,
  type AnyRawComputation,
  type RawComputationContext,
} from "../raw";
import { ComputationDescription } from "../description";
import { ComputationPool, ComputationPoolDescription } from "./pool";
import {
  type ReachableComputation,
  ReachableComputationMixin,
  ReachableComputationMixinRoot,
} from "../mixins/reachable";
import { type CtxWithFS } from "../file-system/file-system";
import { CacheableComputationMixin } from "../mixins/cacheable";
import { serializationDB } from "../../utils/serialization-db";

type ComputationEntryJobDescriptionJSON<Req, Res> = {
  readonly poolDesc: ComputationPoolDescription<Req, Res>;
};

export class ComputationEntryJobDescription<
  Req,
  Res,
> extends ComputationDescription<ComputationEntryJob<Req, Res>> {
  public readonly poolDesc: ComputationPoolDescription<Req, Res>;

  constructor(poolDesc: ComputationPoolDescription<Req, Res>) {
    super();
    this.poolDesc = poolDesc;
  }

  create(registry: ComputationRegistry<any>): ComputationEntryJob<Req, Res> {
    return new ComputationEntryJob(
      registry,
      this,
      registry.make(this.poolDesc)
    );
  }

  equal<O extends AnyRawComputation>(other: ComputationDescription<O>) {
    return (
      other instanceof ComputationEntryJobDescription &&
      this.poolDesc.equal(other.poolDesc)
    );
  }

  hash() {
    return 0;
  }

  getCacheKey() {
    return `PoolEntry{${this.poolDesc.getCacheKey()}}`;
  }
}

serializationDB.register<
  ComputationEntryJobDescription<any, any>,
  ComputationEntryJobDescriptionJSON<any, any>
>(ComputationEntryJobDescription, {
  name: "ComputationEntryJobDescription",
  serialize(value) {
    return {
      poolDesc: value.poolDesc,
    };
  },
  deserialize(out) {
    return new ComputationEntryJobDescription(out.poolDesc);
  },
});

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
    registry: ComputationRegistry<any>,
    desc: ComputationDescription<any>,
    pool: ComputationPool<Req, Res>
  ) {
    super(registry, desc);
    this.pool = pool;
    this.dependentMixin = new DependentComputationMixin(this);
    this.subscribableMixin = new SubscribableComputationMixin(this);
    this.parentMixin = new ParentComputationMixin(this);
    this.reachableMixin = new ReachableComputationMixinRoot(this);
    this.cacheableMixin = new CacheableComputationMixin(this, desc);
  }

  protected exec(
    ctx: ComputationEntryJobContext<Req>,
    runId: number
  ): Promise<ComputationResult<undefined>> {
    return this.cacheableMixin.exec(this.pool.config.startExec, ctx, runId);
  }

  protected makeContext(runId: number): ComputationEntryJobContext<Req> {
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
    result = this.cacheableMixin.finishRoutine(result, true);
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

  responseEqual(a: undefined, b: undefined): boolean {
    return a === b;
  }
}
