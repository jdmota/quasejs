import {
  RawComputation,
  type StateNotDeleted,
  type StateNotCreating,
  type AnyRawComputation,
  type RawComputationContext,
} from "../computations/raw";
import { ComputationDescription } from "./description";
import {
  type SubscribableComputation,
  SubscribableComputationMixin,
} from "./mixins/subscribable";
import { type ComputationRegistry } from "../incremental-lib";
import { type ValueDefinition } from "../utils/hash-map";
import {
  type ComputationResult,
  ok,
  type VersionedComputationResult,
} from "../utils/result";
import { CacheableComputationMixin } from "./mixins/cacheable";
import { createNotifier, type Notifier } from "../../util/deferred";

export type CellConfig<Res> = {
  readonly name: string;
  readonly responseDef: ValueDefinition<Res>;
};

export function newCell<Res>(config: CellConfig<Res>) {
  return new CellDescription(config);
}

export class CellDescription<Res> extends ComputationDescription<
  CellComputation<Res>
> {
  readonly config: CellConfig<Res>;

  constructor(config: CellConfig<Res>) {
    super();
    this.config = config;
  }

  create(registry: ComputationRegistry<any>): CellComputation<Res> {
    return new CellComputation(registry, this);
  }

  equal<O extends AnyRawComputation>(other: ComputationDescription<O>) {
    return other instanceof CellDescription && this.config === other.config;
  }

  hash() {
    return 31 * this.config.name.length;
  }

  getCacheKey() {
    return `Cell{${this.config.name}}`;
  }
}

export class CellComputation<Res>
  extends RawComputation<RawComputationContext, Res>
  implements SubscribableComputation<Res>
{
  public readonly desc: CellDescription<Res>;
  public readonly subscribableMixin: SubscribableComputationMixin<Res>;
  public readonly cacheableMixin: CacheableComputationMixin<
    CellComputation<Res>
  >;
  protected readonly config: CellConfig<Res>;
  protected cellResult: ComputationResult<Res> | null;
  private notifier: Notifier<null>;
  private executed = false;

  constructor(registry: ComputationRegistry<any>, desc: CellDescription<Res>) {
    super(registry, desc);
    this.desc = desc;
    this.subscribableMixin = new SubscribableComputationMixin(this);
    this.cacheableMixin = new CacheableComputationMixin(this, desc);
    this.config = desc.config;
    this.cellResult = null;
    this.notifier = createNotifier();
  }

  clear() {
    this.cellResult = null;
  }

  set(value: Res) {
    this.cellResult = ok(value);
    if (this.notifier.isWaiting()) {
      this.notifier.done(null);
    } else if (this.executed) {
      this.registry.externalInvalidate(this);
    }
  }

  protected async exec(
    ctx: RawComputationContext,
    runId: number
  ): Promise<ComputationResult<Res>> {
    this.executed = true;
    await this.cacheableMixin.preExec();
    // Wait for the value...
    while (this.cellResult == null) {
      // Ensure this running id is active before doing side-effects
      ctx.checkActive();
      await this.notifier.wait();
      // In case invalidations occured between notifier.done()
      // and this computation resuming, keep waiting if not done
    }
    return this.cellResult;
  }

  protected makeContext(runId: number): RawComputationContext {
    return {
      checkActive: () => this.checkActive(runId),
    };
  }

  protected isOrphan(): boolean {
    // TODO well, the lib will complain that there are computations remaining after cleanup with this...
    return false;
  }

  protected finishRoutine(result: VersionedComputationResult<Res>) {
    result = this.subscribableMixin.finishRoutine(result);
    result = this.cacheableMixin.finishRoutine(result, false);
    return result;
  }

  protected invalidateRoutine() {
    this.executed = false;
    this.notifier.cancel();
    this.subscribableMixin.invalidateRoutine();
    this.cacheableMixin.invalidateRoutine();
  }

  protected deleteRoutine() {
    this.executed = false;
    this.notifier.cancel();
    this.subscribableMixin.deleteRoutine();
    this.cacheableMixin.deleteRoutine();
  }

  protected onStateChange(from: StateNotDeleted, to: StateNotCreating): void {}

  responseEqual(a: Res, b: Res): boolean {
    return this.config.responseDef.equal(a, b);
  }
}
