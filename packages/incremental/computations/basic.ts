import { ComputationRegistry } from "../incremental-lib";
import {
  RawComputation,
  State,
  StateNotDeleted,
  StateNotCreating,
  AnyRawComputation,
  RawComputationContext,
} from "../computations/raw";
import { ValueDefinition } from "../utils/hash-map";
import { ComputationResult, VersionedComputationResult } from "../utils/result";
import { ComputationDescription } from "./description";
import { CtxWithFS } from "./file-system/file-system";
import {
  SubscribableComputation,
  SubscribableComputationMixin,
} from "./mixins/subscribable";
import {
  DependentComputation,
  DependentComputationMixin,
  DependentContext,
} from "./mixins/dependent";
import { CacheableComputationMixin } from "./mixins/cacheable";
import {
  EmitterDoneComputation,
  EmitterDoneComputationMixin,
} from "./mixins/emitter-done";
import { serializationDB } from "../utils/serialization-db";

export type BasicComputationExec<Req, Res> = (
  ctx: BasicComputationContext<Req>
) => Promise<ComputationResult<Res>>;

export type BasicComputationConfig<Req, Res> = {
  readonly key: string;
  readonly exec: BasicComputationExec<Req, Res>;
  readonly requestDef: ValueDefinition<Req>;
  readonly responseDef: ValueDefinition<Res>;
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

type BasicComputationDescriptionJSON<Req, Res> = {
  readonly config: BasicComputationConfig<Req, Res>;
  readonly request: Req;
};

export class BasicComputationDescription<
  Req,
  Res,
> extends ComputationDescription<BasicComputation<Req, Res>> {
  readonly config: BasicComputationConfig<Req, Res>;
  readonly request: Req;

  constructor(config: BasicComputationConfig<Req, Res>, request: Req) {
    super();
    this.config = config;
    this.request = request;
  }

  create(registry: ComputationRegistry): BasicComputation<Req, Res> {
    return new BasicComputation(registry, this);
  }

  equal<O extends AnyRawComputation>(other: ComputationDescription<O>) {
    return (
      other instanceof BasicComputationDescription &&
      this.config.key === other.config.key &&
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
    return `Basic{${this.config.key},${this.config.requestDef.hash(this.request)}}`;
  }
}

serializationDB.register<
  BasicComputationDescription<any, any>,
  BasicComputationDescriptionJSON<any, any>
>(BasicComputationDescription, {
  name: "BasicComputationDescription",
  serialize(value) {
    return {
      request: value.request,
      config: value.config,
    };
  },
  deserialize(out) {
    return new BasicComputationDescription(out.config, out.request);
  },
});

export class BasicComputation<Req, Res>
  extends RawComputation<BasicComputationContext<Req>, Res>
  implements
    DependentComputation,
    SubscribableComputation<Res>,
    EmitterDoneComputation<Res>
{
  public readonly desc: BasicComputationDescription<Req, Res>;
  public readonly dependentMixin: DependentComputationMixin;
  public readonly subscribableMixin: SubscribableComputationMixin<Res>;
  public readonly cacheableMixin: CacheableComputationMixin<
    BasicComputation<Req, Res>
  >;
  public readonly emitterMixin: EmitterDoneComputationMixin<Res>;
  protected readonly config: BasicComputationConfig<Req, Res>;
  protected readonly request: Req;

  constructor(
    registry: ComputationRegistry,
    desc: BasicComputationDescription<Req, Res>
  ) {
    super(registry, desc);
    this.desc = desc;
    this.dependentMixin = new DependentComputationMixin(this);
    this.subscribableMixin = new SubscribableComputationMixin(this);
    this.cacheableMixin = new CacheableComputationMixin(this, desc);
    this.emitterMixin = new EmitterDoneComputationMixin(this);
    this.config = desc.config;
    this.request = desc.request;
  }

  protected exec(
    ctx: BasicComputationContext<Req>,
    runId: number
  ): Promise<ComputationResult<Res>> {
    return this.cacheableMixin.exec(this.config.exec, ctx, runId);
  }

  protected makeContext(runId: number): BasicComputationContext<Req> {
    return this.registry.fs.extend({
      request: this.request,
      checkActive: () => this.checkActive(runId),
      ...this.dependentMixin.makeContextRoutine(runId),
    });
  }

  protected isOrphan(): boolean {
    return this.subscribableMixin.isOrphan() && this.emitterMixin.isOrphan();
  }

  protected finishRoutine(result: VersionedComputationResult<Res>) {
    result = this.subscribableMixin.finishRoutine(result);
    result = this.cacheableMixin.finishRoutine(result, true);
    result = this.emitterMixin.finishRoutine(result);
    return result;
  }

  protected invalidateRoutine() {
    this.dependentMixin.invalidateRoutine();
    this.subscribableMixin.invalidateRoutine();
    this.cacheableMixin.invalidateRoutine();
    this.emitterMixin.invalidateRoutine();
  }

  protected deleteRoutine() {
    this.dependentMixin.deleteRoutine();
    this.subscribableMixin.deleteRoutine();
    this.cacheableMixin.deleteRoutine();
    this.emitterMixin.deleteRoutine();
  }

  protected onStateChange(from: StateNotDeleted, to: StateNotCreating): void {}

  responseEqual(a: Res, b: Res): boolean {
    return this.config.responseDef.equal(a, b);
  }
}
