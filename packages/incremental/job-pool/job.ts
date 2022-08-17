import {
  ComputationRegistry,
  ComputationDescription,
} from "../incremental-lib";
import { Result } from "../utils/result";
import { ChildComputation, ChildComputationMixin } from "../computations/child";
import {
  DependentComputation,
  DependentComputationMixin,
} from "../computations/dependent";
import {
  ParentComputation,
  ParentComputationMixin,
} from "../computations/parent";
import { SubscribableComputation } from "../computations/subscribable";
import {
  State,
  RunId,
  StateNotDeleted,
  StateNotCreating,
  RawComputation,
  AnyRawComputation,
} from "../computations/raw";
import { ComputationPool } from "./pool";

export class ComputationJobInPoolDescription<Req, Res>
  implements ComputationDescription<ComputationJobInPool<Req, Res>>
{
  private readonly request: Req;
  private readonly source: ComputationPool<Req, Res>;

  constructor(request: Req, source: ComputationPool<Req, Res>) {
    this.request = request;
    this.source = source;
  }

  create(registry: ComputationRegistry): ComputationJobInPool<Req, Res> {
    return new ComputationJobInPool(registry, this, this.request, this.source);
  }

  equal<O extends AnyRawComputation>(other: ComputationDescription<O>) {
    return (
      other instanceof ComputationJobInPoolDescription &&
      this.source === other.source &&
      this.source.mapDefinition.requestDef.equal(this.request, other.request)
    );
  }

  hash() {
    return this.source.mapDefinition.requestDef.hash(this.request);
  }
}

export type ComputationJobInPoolContext<Req> = {
  readonly get: <T>(dep: SubscribableComputation<T>) => Promise<Result<T>>;
  readonly compute: (req: Req) => void;
  readonly request: Req;
};

class ComputationJobInPool<Req, Res>
  extends RawComputation<ComputationJobInPoolContext<Req>, Res>
  implements DependentComputation, ParentComputation, ChildComputation
{
  private readonly source: ComputationPool<Req, Res>;
  public readonly request: Req;
  public readonly dependentMixin: DependentComputationMixin;
  public readonly parentMixin: ParentComputationMixin;
  public readonly childrenMixin: ChildComputationMixin;

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
    this.childrenMixin = new ChildComputationMixin(this);
    this.mark(State.PENDING);
  }

  protected exec(ctx: ComputationJobInPoolContext<Req>): Promise<Result<Res>> {
    return this.source.mapDefinition.exec(ctx);
  }

  protected makeContext(runId: RunId): ComputationJobInPoolContext<Req> {
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
