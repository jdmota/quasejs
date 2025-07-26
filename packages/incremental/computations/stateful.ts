import { ComputationRegistry } from "../incremental-lib";
import { ValueDefinition } from "../utils/hash-map";
import { ComputationResult, VersionedComputationResult } from "../utils/result";
import {
  EmitterComputation,
  EmitterComputationMixin,
  EmitterContext,
} from "./mixins/emitter";
import {
  ObserverComputation,
  ObserverComputationMixin,
  ObserverContext,
} from "./mixins/observer";
import {
  SubscribableComputation,
  SubscribableComputationMixin,
} from "./mixins/subscribable";
import {
  AnyRawComputation,
  RawComputation,
  RawComputationContext,
  State,
  StateNotCreating,
  StateNotDeleted,
} from "./raw";
import { ComputationDescription } from "./description";
import { CacheableComputationMixin } from "./mixins/cacheable";
import { serializationDB } from "../utils/serialization-db";

type StatefulComputationCtx<K, V, R> = EmitterContext<K, V, R> &
  ObserverContext;

export type AnyStatefulComputation = StatefulComputation<any, any, any>;

type StatefulComputationExec<K, V, R> = (
  ctx: StatefulComputationCtx<K, V, R>
) => void;

type StatefulComputationConfig<K, V, R> = {
  readonly key: string;
  readonly init: StatefulComputationExec<K, V, R>;
  readonly keyDef: ValueDefinition<K>;
  readonly valueDef: ValueDefinition<V>;
  readonly doneDef: ValueDefinition<R>;
};

export function newStatefulComputation<K, V, R>(
  config: StatefulComputationConfig<K, V, R>
) {
  return new StatefulComputationDescription(config);
}

export class StatefulComputationDescription<
  K,
  V,
  R,
> extends ComputationDescription<StatefulComputation<K, V, R>> {
  readonly config: StatefulComputationConfig<K, V, R>;

  constructor(config: StatefulComputationConfig<K, V, R>) {
    super();
    this.config = config;
  }

  create(registry: ComputationRegistry): StatefulComputation<K, V, R> {
    return new StatefulComputation(registry, this);
  }

  equal<O extends AnyRawComputation>(other: ComputationDescription<O>) {
    return (
      other instanceof StatefulComputationDescription &&
      this.config.key === other.config.key &&
      this.config.init === other.config.init &&
      this.config.keyDef === other.config.keyDef &&
      this.config.valueDef === other.config.valueDef &&
      this.config.doneDef === other.config.doneDef
    );
  }

  hash() {
    return 0;
  }

  getCacheKey() {
    return `Stateful${this.config.key}`;
  }
}

serializationDB.register<
  StatefulComputationDescription<any, any, any>,
  StatefulComputationConfig<any, any, any>
>(StatefulComputationDescription, {
  name: "StatefulComputationDescription",
  serialize(value) {
    return value.config;
  },
  deserialize(out) {
    return new StatefulComputationDescription(out);
  },
});

enum StatefulPhase {
  PENDING = 0,
  INITIALIZING = 1,
  READY = 2,
}

export class StatefulComputation<K, V, R>
  extends RawComputation<RawComputationContext, R>
  implements
    SubscribableComputation<R>,
    EmitterComputation<K, V, R>,
    ObserverComputation
{
  private readonly config: StatefulComputationConfig<K, V, R>;
  readonly subscribableMixin: SubscribableComputationMixin<R>;
  public readonly cacheableMixin: CacheableComputationMixin<
    StatefulComputation<K, V, R>
  >;
  readonly emitterMixin: EmitterComputationMixin<K, V, R>;
  readonly observerMixin: ObserverComputationMixin;
  private phase: StatefulPhase;

  constructor(
    registry: ComputationRegistry,
    desc: StatefulComputationDescription<K, V, R>
  ) {
    super(registry, desc);
    this.config = desc.config;
    this.subscribableMixin = new SubscribableComputationMixin(this);
    this.cacheableMixin = new CacheableComputationMixin(this, desc);
    this.emitterMixin = new EmitterComputationMixin(
      this,
      this.config.keyDef,
      this.config.valueDef.equal
    );
    this.observerMixin = new ObserverComputationMixin(this);
    this.phase = StatefulPhase.PENDING;
  }

  protected async exec(
    ctx: RawComputationContext,
    runId: number
  ): Promise<ComputationResult<R>> {
    let emitId;
    try {
      if (this.phase === StatefulPhase.PENDING) {
        this.phase = StatefulPhase.INITIALIZING;
        emitId = this.emitterMixin.newEmitRunId();
        const observerId = this.observerMixin.newObserverInitId();
        this.config.init({
          ...this.observerMixin.makeContextRoutine(runId, observerId),
          ...this.emitterMixin.makeContextRoutine(emitId),
        });
        this.observerMixin.finishObserverInit();
        this.observerMixin.askForInitial(runId);
        this.phase = StatefulPhase.READY;
      } else {
        emitId = this.emitterMixin.getEmitRunId();
      }
    } catch (err) {
      this.resetRoutine();
      throw err;
    }
    await this.cacheableMixin.preExec();
    return this.emitterMixin.exec(runId, emitId);
  }

  protected makeContext(runId: number): RawComputationContext {
    return {
      checkActive: () => this.checkActive(runId),
    };
  }

  protected isOrphan(): boolean {
    return this.subscribableMixin.isOrphan() && this.emitterMixin.isOrphan();
  }

  protected finishRoutine(result: VersionedComputationResult<R>) {
    result = this.subscribableMixin.finishRoutine(result);
    result = this.cacheableMixin.finishRoutine(result, false);
    return result;
  }

  private resetRoutine() {
    this.phase = StatefulPhase.PENDING;
    this.emitterMixin.resetRoutine();
    this.observerMixin.resetRoutine();
  }

  protected invalidateRoutine() {
    this.subscribableMixin.invalidateRoutine();
    this.cacheableMixin.invalidateRoutine();
    this.emitterMixin.invalidateRoutine();
  }

  protected deleteRoutine() {
    this.subscribableMixin.deleteRoutine();
    this.cacheableMixin.deleteRoutine();
    this.resetRoutine();
  }

  protected onStateChange(from: StateNotDeleted, to: StateNotCreating): void {}

  responseEqual(a: R, b: R): boolean {
    return this.config.doneDef.equal(a, b);
  }
}
