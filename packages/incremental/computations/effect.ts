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
import type { SubscribableComputation } from "./mixins/subscribable";
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
};

export type CleanupFn = () => void | Promise<void>;

const NOOP_CLEANUP: CleanupFn = () => {};

type EffectComputationContext<Req> = {
  readonly request: Req;
  readonly checkActive: () => void;
  readonly get: <T>(
    dep: ComputationDescription<
      RawComputation<any, T> & SubscribableComputation<T>
    >
  ) => Promise<ComputationResult<T>>;
  readonly cleanup: (fn: CleanupFn) => void;
};

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
      this.config.requestDef === other.config.requestDef
    );
  }

  hash() {
    return this.config.requestDef.hash(this.request) + 31;
  }
}

export class EffectComputation<Req, Res>
  extends RawComputation<EffectComputationContext<Req>, Res>
  implements DependentComputation
{
  public readonly dependentMixin: DependentComputationMixin;
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
    this.config = description.config;
    this.request = description.request;
    this.rooted = true;
    this.cleanup = NOOP_CLEANUP;
    this.mark(State.PENDING);
  }

  protected async exec(
    ctx: EffectComputationContext<Req>
  ): Promise<ComputationResult<Res>> {
    const { cleanup } = this;
    this.cleanup = NOOP_CLEANUP;
    try {
      await cleanup();
    } catch (err: unknown) {
      // TODO
      throw err;
    }
    return this.config.exec(ctx);
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
    return !this.rooted;
  }

  protected finishRoutine(result: ComputationResult<Res>): void {}

  protected invalidateRoutine(): void {
    this.dependentMixin.invalidateRoutine();
  }

  protected deleteRoutine(): void {
    this.dependentMixin.deleteRoutine();
  }

  protected onStateChange(from: StateNotDeleted, to: StateNotCreating): void {}

  unroot() {
    this.rooted = false;
  }
}
