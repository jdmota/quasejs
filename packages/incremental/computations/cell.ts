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
import {
  ComputationResult,
  ok,
  VersionedComputationResult,
} from "../utils/result";
import { CacheableComputationMixin } from "./mixins/cacheable";
import { createNotifier, Notifier } from "../../util/deferred";

export type CellConfig<Res> = {
  readonly name: string;
  readonly responseDef: ValueDefinition<Res>;
};

export function newCell<Res>(config: CellConfig<Res>) {
  return new CellDescription(config);
}

export class CellDescription<Res>
  implements ComputationDescription<CellComputation<Res>>
{
  readonly config: CellConfig<Res>;

  constructor(config: CellConfig<Res>) {
    this.config = config;
  }

  create(registry: ComputationRegistry): CellComputation<Res> {
    return new CellComputation(registry, this);
  }

  equal<O extends AnyRawComputation>(other: ComputationDescription<O>) {
    return (
      other instanceof CellDescription &&
      this.config.name === other.config.name &&
      this.config.responseDef === other.config.responseDef
    );
  }

  hash() {
    return 31 * this.config.name.length;
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

  constructor(
    registry: ComputationRegistry,
    desc: CellDescription<Res>,
    mark: boolean = true
  ) {
    super(registry, desc, false);
    this.desc = desc;
    this.subscribableMixin = new SubscribableComputationMixin(this);
    this.cacheableMixin = new CacheableComputationMixin(this, desc);
    this.config = desc.config;
    this.cellResult = null;
    this.notifier = createNotifier();
    if (mark) this.mark(State.PENDING);
  }

  clear() {
    this.cellResult = null;
  }

  set(value: Res) {
    this.cellResult = ok(value);
    this.notifier.done(null);
    this.registry.externalInvalidate(this);
  }

  protected async exec(
    ctx: RawComputationContext,
    runId: RunId
  ): Promise<ComputationResult<Res>> {
    // Wait for the value...
    while (this.cellResult == null) {
      // Ensure this running version is active before doing side-effects
      ctx.checkActive();
      await this.notifier.wait();
      // In case invalidations occured between notifier.done()
      // and this computation resuming, keep waiting if not done
    }
    return this.cellResult;
  }

  protected makeContext(runId: RunId): RawComputationContext {
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
    result = this.cacheableMixin.finishRoutine(result);
    return result;
  }

  protected invalidateRoutine(): void {
    this.notifier.cancel();
    this.subscribableMixin.invalidateRoutine();
    this.cacheableMixin.invalidateRoutine();
  }

  protected deleteRoutine(): void {
    this.notifier.cancel();
    this.subscribableMixin.deleteRoutine();
    this.cacheableMixin.deleteRoutine();
  }

  protected onStateChange(from: StateNotDeleted, to: StateNotCreating): void {}

  override responseEqual(a: Res, b: Res): boolean {
    return this.config.responseDef.equal(a, b);
  }

  onNewResult(result: VersionedComputationResult<Res>): void {}
}
