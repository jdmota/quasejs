import {
  DependentComputation,
  DependentComputationMixin,
} from "./mixins/dependent";
import {
  RawComputation,
  State,
  RunId,
  StateNotDeleted,
  StateNotCreating,
  AnyRawComputation,
} from "../computations/raw";
import {
  SubscribableComputation,
  SubscribableComputationMixin,
} from "./mixins/subscribable";
import {
  ComputationDescription,
  ComputationRegistry,
} from "../incremental-lib";
import { ValueDefinition } from "../utils/hash-map";
import { Result } from "../utils/result";

type BasicComputationExec<Req, Res> = (
  ctx: BasicComputationContext<Req>
) => Promise<Result<Res>>;

type BasicComputationConfig<Req, Res> = {
  readonly exec: BasicComputationExec<Req, Res>;
  readonly requestDef: ValueDefinition<Req>;
  readonly responseDef: ValueDefinition<Res>;
  readonly root?: boolean;
};

type BasicComputationContext<Req> = {
  readonly request: Req;
  readonly get: <T>(
    dep: ComputationDescription<
      RawComputation<any, T> & SubscribableComputation<T>
    >
  ) => Promise<Result<T>>;
};

export function newComputationBuilder<Req, Res>(
  config: BasicComputationConfig<Req, Res>
) {
  return (request: Req) => new BasicComputationDescription(config, request);
}

export class BasicComputationDescription<Req, Res>
  implements ComputationDescription<BasicComputation<Req, Res>>
{
  readonly config: BasicComputationConfig<Req, Res>;
  readonly request: Req;

  constructor(config: BasicComputationConfig<Req, Res>, request: Req) {
    this.config = config;
    this.request = request;
  }

  create(registry: ComputationRegistry): BasicComputation<Req, Res> {
    return new BasicComputation(registry, this);
  }

  equal<O extends AnyRawComputation>(other: ComputationDescription<O>) {
    return (
      other instanceof BasicComputationDescription &&
      this.config.exec === other.config.exec &&
      this.config.requestDef === other.config.requestDef &&
      this.config.responseDef === other.config.responseDef &&
      !!this.config.root === !!other.config.root
    );
  }

  hash() {
    return (
      this.config.requestDef.hash(this.request) +
      31 * (this.config.root ? 1 : 0)
    );
  }
}

export class BasicComputation<Req, Res>
  extends RawComputation<BasicComputationContext<Req>, Res>
  implements DependentComputation, SubscribableComputation<Res>
{
  public readonly dependentMixin: DependentComputationMixin;
  public readonly subscribableMixin: SubscribableComputationMixin<Res>;
  private readonly config: BasicComputationConfig<Req, Res>;
  private readonly request: Req;
  private rooted: boolean;

  constructor(
    registry: ComputationRegistry,
    description: BasicComputationDescription<Req, Res>
  ) {
    super(registry, description, false);
    this.dependentMixin = new DependentComputationMixin(this);
    this.subscribableMixin = new SubscribableComputationMixin(this);
    this.config = description.config;
    this.request = description.request;
    this.rooted = !!description.config.root;
    this.mark(State.PENDING);
  }

  protected exec(ctx: BasicComputationContext<Req>): Promise<Result<Res>> {
    return this.config.exec(ctx);
  }

  protected makeContext(runId: RunId): BasicComputationContext<Req> {
    return {
      request: this.request,
      ...this.dependentMixin.makeContextRoutine(runId),
    };
  }

  protected isOrphan(): boolean {
    return this.rooted ? false : this.subscribableMixin.isOrphan();
  }

  protected finishRoutine(result: Result<Res>): void {
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

  protected onStateChange(from: StateNotDeleted, to: StateNotCreating): void {}

  responseEqual(a: Res, b: Res): boolean {
    return this.config.responseDef.equal(a, b);
  }

  onNewResult(result: Result<Res>): void {}

  unroot() {
    this.rooted = false;
  }

  /*protected inNodesRoutine(): IterableIterator<AnyRawComputation> {
    return this.subscribableMixin.inNodesRoutine();
  }

  protected outNodesRoutine(): IterableIterator<AnyRawComputation> {
    return this.dependentMixin.outNodesRoutine();
  }*/
}
