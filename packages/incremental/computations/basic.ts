import {
  DependentComputation,
  DependentComputationMixin,
  DependentContext,
} from "./mixins/dependent";
import {
  RawComputation,
  State,
  RunId,
  StateNotDeleted,
  StateNotCreating,
  AnyRawComputation,
  RawComputationContext,
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
import { ComputationResult, VersionedComputationResult } from "../utils/result";
import { CacheableComputationMixin } from "./mixins/cacheable";
import { CtxWithFS } from "./file-system/file-system";

export type BasicComputationExec<Req, Res> = (
  ctx: BasicComputationContext<Req>
) => Promise<ComputationResult<Res>>;

export type BasicComputationConfig<Req, Res> = {
  readonly exec: BasicComputationExec<Req, Res>;
  readonly requestDef: ValueDefinition<Req>;
  readonly responseDef: ValueDefinition<Res>;
  readonly root?: boolean;
};

export type BasicComputationContext<Req> = {
  readonly request: Req;
} & DependentContext &
  CtxWithFS &
  RawComputationContext;

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
      !!this.config.root === !!other.config.root &&
      this.config.requestDef.equal(this.request, other.request)
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
  public readonly desc: BasicComputationDescription<Req, Res>;
  public readonly dependentMixin: DependentComputationMixin;
  public readonly subscribableMixin: SubscribableComputationMixin<Res>;
  public readonly cacheableMixin: CacheableComputationMixin<
    BasicComputation<Req, Res>
  >;
  protected readonly config: BasicComputationConfig<Req, Res>;
  protected readonly request: Req;
  private rooted: boolean;

  constructor(
    registry: ComputationRegistry,
    desc: BasicComputationDescription<Req, Res>,
    mark: boolean = true
  ) {
    super(registry, desc, false);
    this.desc = desc;
    this.dependentMixin = new DependentComputationMixin(this);
    this.subscribableMixin = new SubscribableComputationMixin(this);
    this.cacheableMixin = new CacheableComputationMixin(this, desc);
    // TODO cacheable compatible with effect?
    this.config = desc.config;
    this.request = desc.request;
    this.rooted = !!desc.config.root;
    if (mark) this.mark(State.PENDING);
  }

  protected exec(
    ctx: BasicComputationContext<Req>
  ): Promise<ComputationResult<Res>> {
    return this.cacheableMixin.exec(this.config.exec, ctx);
  }

  protected makeContext(runId: RunId): BasicComputationContext<Req> {
    return this.registry.fs.extend({
      request: this.request,
      checkActive: () => this.checkActive(runId),
      ...this.dependentMixin.makeContextRoutine(runId),
    });
  }

  protected isOrphan(): boolean {
    return this.rooted ? false : this.subscribableMixin.isOrphan();
  }

  protected finishRoutine(result: VersionedComputationResult<Res>): void {
    this.subscribableMixin.finishRoutine(result);
    this.cacheableMixin.finishRoutine(result);
  }

  protected invalidateRoutine(): void {
    this.dependentMixin.invalidateRoutine();
    this.subscribableMixin.invalidateRoutine();
    this.cacheableMixin.invalidateRoutine();
  }

  protected deleteRoutine(): void {
    this.dependentMixin.deleteRoutine();
    this.subscribableMixin.deleteRoutine();
    this.cacheableMixin.deleteRoutine();
  }

  protected onStateChange(from: StateNotDeleted, to: StateNotCreating): void {}

  override responseEqual(a: Res, b: Res): boolean {
    return this.config.responseDef.equal(a, b);
  }

  onNewResult(result: VersionedComputationResult<Res>): void {}

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
