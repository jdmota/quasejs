import {
  DependentComputation,
  DependentComputationMixin,
  DependentContext,
} from "./mixins/dependent";
import {
  RawComputation,
  State,
  StateNotDeleted,
  StateNotCreating,
  AnyRawComputation,
  RawComputationContext,
} from "../computations/raw";
import { ComputationDescription } from "./description";
import {
  SubscribableComputation,
  SubscribableComputationMixin,
} from "./mixins/subscribable";
import { ComputationRegistry } from "../incremental-lib";
import { ValueDefinition } from "../utils/hash-map";
import { ComputationResult, VersionedComputationResult } from "../utils/result";
import {
  EffectComputationMixin,
  IEffectComputation,
  EffectContext,
} from "./mixins/effect";

export type EffectComputationExec<Req, Res> = (
  ctx: EffectComputationContext<Req>
) => Promise<ComputationResult<Res>>;

export type EffectComputationConfig<Req, Res> = {
  readonly exec: EffectComputationExec<Req, Res>;
  readonly requestDef: ValueDefinition<Req>;
  readonly responseDef: ValueDefinition<Res>;
};

export type EffectComputationContext<Req> = {
  readonly request: Req;
} & EffectContext &
  DependentContext &
  RawComputationContext;

export function newEffectComputationBuilder<Req, Res>(
  config: EffectComputationConfig<Req, Res>
) {
  return (request: Req) => new EffectComputationDescription(config, request);
}

export class EffectComputationDescription<
  Req,
  Res,
> extends ComputationDescription<EffectComputation<Req, Res>> {
  readonly config: EffectComputationConfig<Req, Res>;
  readonly request: Req;

  constructor(config: EffectComputationConfig<Req, Res>, request: Req) {
    super();
    this.config = config;
    this.request = request;
  }

  create(registry: ComputationRegistry): EffectComputation<Req, Res> {
    return new EffectComputation(registry, this);
  }

  equal<O extends AnyRawComputation>(other: ComputationDescription<O>) {
    return (
      other instanceof EffectComputationDescription &&
      this.config.exec === other.config.exec &&
      this.config.requestDef === other.config.requestDef &&
      this.config.responseDef === other.config.responseDef &&
      this.config.requestDef.equal(this.request, other.request)
    );
  }

  hash() {
    return this.config.requestDef.hash(this.request) + 31;
  }

  getCacheKey() {
    return "";
  }
}

export class EffectComputation<Req, Res>
  extends RawComputation<EffectComputationContext<Req>, Res>
  implements
    DependentComputation,
    SubscribableComputation<Res>,
    IEffectComputation
{
  public readonly dependentMixin: DependentComputationMixin;
  public readonly subscribableMixin: SubscribableComputationMixin<Res>;
  public readonly effectMixin: EffectComputationMixin;
  private readonly config: EffectComputationConfig<Req, Res>;
  private readonly request: Req;

  constructor(
    registry: ComputationRegistry,
    description: EffectComputationDescription<Req, Res>
  ) {
    super(registry, description);
    this.dependentMixin = new DependentComputationMixin(this);
    this.subscribableMixin = new SubscribableComputationMixin(this);
    this.effectMixin = new EffectComputationMixin(this);
    this.config = description.config;
    this.request = description.request;
  }

  protected async exec(
    ctx: EffectComputationContext<Req>
  ): Promise<ComputationResult<Res>> {
    await this.effectMixin.performCleanup(false);
    return this.config.exec(ctx);
  }

  protected makeContext(runId: number): EffectComputationContext<Req> {
    return {
      request: this.request,
      checkActive: () => this.checkActive(runId),
      ...this.dependentMixin.makeContextRoutine(runId),
      ...this.effectMixin.makeContextRoutine(runId),
    };
  }

  protected isOrphan(): boolean {
    return this.subscribableMixin.isOrphan();
  }

  protected finishRoutine(result: VersionedComputationResult<Res>) {
    return this.subscribableMixin.finishRoutine(result);
  }

  protected invalidateRoutine(): void {
    this.dependentMixin.invalidateRoutine();
    this.subscribableMixin.invalidateRoutine();
  }

  protected deleteRoutine(): void {
    this.dependentMixin.deleteRoutine();
    this.subscribableMixin.deleteRoutine();
    this.effectMixin.deleteRoutine();
  }

  protected onStateChange(from: StateNotDeleted, to: StateNotCreating): void {}

  responseEqual(a: Res, b: Res): boolean {
    return this.config.responseDef.equal(a, b);
  }
}
