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
import { ComputationResult, ok } from "../utils/result";

type EffectComputationExec<Req, Res> = (
  ctx: EffectComputationContext<Req>
) => Promise<ComputationResult<Res>>;

type EffectComputationConfig<Req, Res> = {
  readonly exec: EffectComputationExec<Req, Res>;
  readonly requestDef: ValueDefinition<Req>;
  readonly responseDef: ValueDefinition<Res>;
  readonly root?: boolean;
};

export type CleanupFn = (deleting: boolean) => void | Promise<void>;

const NOOP_CLEANUP: CleanupFn = () => {};

type EffectComputationContext<Req> = {
  readonly request: Req;
  readonly checkActive: () => void;
  readonly get: <T>(
    desc: ComputationDescription<
      RawComputation<any, T> & SubscribableComputation<T>
    >
  ) => Promise<ComputationResult<T>>;
  readonly getOk: <T>(
    desc: ComputationDescription<
      RawComputation<any, T> & SubscribableComputation<T>
    >
  ) => Promise<T>;
  readonly cleanup: (fn: CleanupFn) => void;
};

export function newEffectComputationBuilder<Req, Res>(
  config: EffectComputationConfig<Req, Res>
) {
  return (request: Req) => new EffectComputationDescription(config, request);
}

export class EffectComputationDescription<Req, Res>
  implements ComputationDescription<EffectComputation<Req, Res>>
{
  readonly config: EffectComputationConfig<Req, Res>;
  readonly request: Req;

  constructor(config: EffectComputationConfig<Req, Res>, request: Req) {
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

  serializer() {
    return null;
  }
}

export class EffectComputation<Req, Res>
  extends RawComputation<EffectComputationContext<Req>, Res>
  implements DependentComputation, SubscribableComputation<Res>
{
  public readonly dependentMixin: DependentComputationMixin;
  public readonly subscribableMixin: SubscribableComputationMixin<Res>;
  private readonly config: EffectComputationConfig<Req, Res>;
  private readonly request: Req;
  private rooted: boolean;
  private cleanup: CleanupFn;

  constructor(
    registry: ComputationRegistry,
    description: EffectComputationDescription<Req, Res>
  ) {
    super(registry, description, false);
    this.dependentMixin = new DependentComputationMixin(this);
    this.subscribableMixin = new SubscribableComputationMixin(this);
    this.config = description.config;
    this.request = description.request;
    this.rooted = !!description.config.root;
    this.cleanup = NOOP_CLEANUP;
    this.mark(State.PENDING);
  }

  protected async exec(
    ctx: EffectComputationContext<Req>
  ): Promise<ComputationResult<Res>> {
    await this.performCleanup(false);
    return this.config.exec(ctx);
  }

  private async performCleanup(deleting: boolean) {
    const { cleanup } = this;
    this.cleanup = NOOP_CLEANUP;
    try {
      await cleanup(deleting);
    } catch (err) {
      if (deleting) {
        this.registry.emitUncaughtError(this.description, err);
      } else {
        throw err;
      }
    }
  }

  protected makeContext(runId: RunId): EffectComputationContext<Req> {
    return {
      request: this.request,
      checkActive: () => this.checkActive(runId),
      cleanup: fn => {
        this.checkActive(runId);
        this.cleanup = fn;
      },
      ...this.dependentMixin.makeContextRoutine(runId),
    };
  }

  protected isOrphan(): boolean {
    return this.rooted ? false : this.subscribableMixin.isOrphan();
  }

  protected finishRoutine(result: ComputationResult<Res>): void {
    this.subscribableMixin.finishRoutine(result);
  }

  protected invalidateRoutine(): void {
    this.dependentMixin.invalidateRoutine();
    this.subscribableMixin.invalidateRoutine();
  }

  protected deleteRoutine(): void {
    this.dependentMixin.deleteRoutine();
    this.subscribableMixin.deleteRoutine();
    this.registry.queueOtherJob(() => this.performCleanup(true));
  }

  protected onStateChange(from: StateNotDeleted, to: StateNotCreating): void {}

  responseEqual(a: Res, b: Res): boolean {
    return this.config.responseDef.equal(a, b);
  }

  onNewResult(result: ComputationResult<Res>): void {}

  unroot() {
    this.rooted = false;
  }
}
