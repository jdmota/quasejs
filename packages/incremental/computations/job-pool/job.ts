import {
  ComputationRegistry,
  ComputationDescription,
} from "../../incremental-lib";
import { Result } from "../../utils/result";
import { ChildComputation, ChildComputationMixin } from "../mixins/child";
import {
  DependentComputation,
  DependentComputationMixin,
} from "../mixins/dependent";
import { ParentComputation, ParentComputationMixin } from "../mixins/parent";
import { SubscribableComputation } from "../mixins/subscribable";
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

export type ComputationJobContext<Req> = {
  readonly get: <T>(
    dep: ComputationDescription<
      RawComputation<any, T> & SubscribableComputation<T>
    >
  ) => Promise<Result<T>>;
  readonly compute: (req: Req) => void;
  readonly request: Req;
};

class ComputationJob<Req, Res>
  extends RawComputation<ComputationJobContext<Req>, Res>
  implements
    DependentComputation,
    ParentComputation,
    ChildComputation,
    ReachableComputation
{
  private readonly source: ComputationPool<Req, Res>;
  public readonly request: Req;
  public readonly dependentMixin: DependentComputationMixin;
  public readonly parentMixin: ParentComputationMixin;
  public readonly childMixin: ChildComputationMixin;
  public readonly reachableMixin: ReachableComputationMixin;

  constructor(
    registry: ComputationRegistry,
    description: ComputationDescription<any>,
    request: Req,
    source: ComputationPool<Req, Res>
  ) {
    super(registry, description, false);
    this.source = source;
    this.request = request;
    this.dependentMixin = new DependentComputationMixin(this);
    this.parentMixin = new ParentComputationMixin(this);
    this.childMixin = new ChildComputationMixin(this);
    this.reachableMixin = new ReachableComputationMixin(this);
    this.mark(State.PENDING);
  }

  protected exec(ctx: ComputationJobContext<Req>): Promise<Result<Res>> {
    return this.source.config.exec(ctx);
  }

  protected makeContext(runId: RunId): ComputationJobContext<Req> {
    return {
      request: this.request,
      compute: req => this.parentMixin.compute(this.source.make(req), runId),
      ...this.dependentMixin.makeContextRoutine(runId),
    };
  }

  protected isOrphan(): boolean {
    return !this.reachableMixin.isReachable();
  }

  protected finishRoutine(result: Result<Res>): void {
    this.reachableMixin.finishOrDeleteRoutine();
    this.source.onFieldFinish(
      this.reachableMixin.isReachable(),
      this.request,
      result
    );
  }

  protected invalidateRoutine(): void {
    this.dependentMixin.invalidateRoutine();
    this.parentMixin.invalidateRoutine();
  }

  protected deleteRoutine(): void {
    this.dependentMixin.deleteRoutine();
    this.parentMixin.deleteRoutine();
    this.reachableMixin.finishOrDeleteRoutine();
    this.source.onFieldDeleted(this.reachableMixin.isReachable(), this.request);
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
    this.source.onFieldStateChange(this.reachableMixin.isReachable(), from, to);
  }

  onReachabilityChange(from: boolean, to: boolean): void {
    this.source.onFieldReachabilityChange(
      this.getState(),
      this.request,
      from,
      to
    );
  }
}
