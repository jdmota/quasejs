import {
  ComputationRegistry,
  ComputationDescription,
} from "../../incremental-lib";
import { ComputationResult } from "../../utils/result";
import {
  DependentComputation,
  DependentComputationMixin,
} from "../mixins/dependent";
import { ParentComputation, ParentComputationMixin } from "../mixins/parent";
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
} from "../raw";
import { ComputationPool } from "./pool";
import {
  ReachableComputation,
  ReachableComputationMixin,
  ReachableComputationMixinRoot,
} from "../mixins/reachable";

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

export type ComputationEntryJobContext<Req> = {
  readonly get: <T>(
    dep: ComputationDescription<
      RawComputation<any, T> & SubscribableComputation<T>
    >
  ) => Promise<ComputationResult<T>>;
  readonly compute: (req: Req) => void;
};

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

  constructor(
    registry: ComputationRegistry,
    description: ComputationDescription<any>,
    pool: ComputationPool<Req, Res>
  ) {
    super(registry, description, false);
    this.pool = pool;
    this.dependentMixin = new DependentComputationMixin(this);
    this.subscribableMixin = new SubscribableComputationMixin(this);
    this.parentMixin = new ParentComputationMixin(this);
    this.reachableMixin = new ReachableComputationMixinRoot(this);
    this.mark(State.PENDING);
  }

  protected exec(
    ctx: ComputationEntryJobContext<Req>
  ): Promise<ComputationResult<undefined>> {
    return this.pool.config.startExec(ctx);
  }

  protected makeContext(runId: RunId): ComputationEntryJobContext<Req> {
    return {
      compute: req => this.parentMixin.compute(this.pool.make(req), runId),
      ...this.dependentMixin.makeContextRoutine(runId),
    };
  }

  protected isOrphan(): boolean {
    return this.subscribableMixin.isOrphan();
  }

  protected finishRoutine(result: ComputationResult<undefined>): void {
    this.subscribableMixin.finishRoutine(result);
    this.reachableMixin.finishOrDeleteRoutine();
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
    this.reachableMixin.finishOrDeleteRoutine();
  }

  protected onStateChange(from: StateNotDeleted, to: StateNotCreating): void {}

  onReachabilityChange(from: boolean, to: boolean): void {}

  responseEqual(a: undefined, b: undefined): boolean {
    return a === b;
  }

  onNewResult(result: ComputationResult<undefined>): void {}
}
