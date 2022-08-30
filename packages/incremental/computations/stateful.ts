import {
  ComputationDescription,
  ComputationRegistry,
} from "../incremental-lib";
import { createDefer, Defer } from "../utils/deferred";
import { Result } from "../utils/result";
import {
  EmitterComputation,
  EmitterComputationMixin,
  EmitterContext,
} from "./mixins/events/emitter";
import {
  ObserverComputation,
  ObserverComputationMixin,
  ObserverContext,
} from "./mixins/events/observer";
import {
  AnyRawComputation,
  RawComputation,
  RunId,
  State,
  StateNotCreating,
  StateNotDeleted,
} from "./raw";

type StatefulComputationCtx<S, E, R> = {
  readonly isActive: () => void;
  readonly checkActive: () => void;
  readonly state: S;
  readonly deferred: Defer<Result<R>>;
} & EmitterContext<E> &
  ObserverContext;

export type AnyStatefulComputation = StatefulComputation<any, any, any>;

type StatefulComputationExec<S, E, R> = (
  ctx: StatefulComputationCtx<S, E, R>
) => Promise<Result<() => void>>;

type StatefulComputationConfig<S, E, R> = {
  readonly initialState: () => S;
  readonly exec: StatefulComputationExec<S, E, R>;
};

export function newStatefulComputation<S, E, R>(
  config: StatefulComputationConfig<S, E, R>
) {
  return new StatefulComputationDescription(config);
}

export class StatefulComputationDescription<S, E, R>
  implements ComputationDescription<StatefulComputation<S, E, R>>
{
  readonly config: StatefulComputationConfig<S, E, R>;

  constructor(config: StatefulComputationConfig<S, E, R>) {
    this.config = config;
  }

  create(registry: ComputationRegistry): StatefulComputation<S, E, R> {
    return new StatefulComputation(registry, this);
  }

  equal<O extends AnyRawComputation>(other: ComputationDescription<O>) {
    return (
      other instanceof StatefulComputationDescription &&
      this.config.exec === other.config.exec &&
      this.config.initialState === other.config.initialState
    );
  }

  hash() {
    return 0;
  }
}

export class StatefulComputation<S, E, R>
  extends RawComputation<StatefulComputationCtx<S, E, R>, R>
  implements EmitterComputation<E>, ObserverComputation
{
  readonly emitterMixin: EmitterComputationMixin<E>;
  readonly observerMixin: ObserverComputationMixin;

  private readonly config: StatefulComputationConfig<S, E, R>;
  private cleanupFn: (() => void) | null;

  constructor(
    registry: ComputationRegistry,
    description: StatefulComputationDescription<S, E, R>
  ) {
    super(registry, description, false);
    this.emitterMixin = new EmitterComputationMixin(this);
    this.observerMixin = new ObserverComputationMixin(this);
    this.config = description.config;
    this.cleanupFn = null;
    this.mark(State.PENDING);
  }

  protected async exec(
    ctx: StatefulComputationCtx<S, E, R>
  ): Promise<Result<R>> {
    const result = await this.config.exec(ctx);
    if (result.ok) {
      // Store the returned cleanup function (if this computation is still active)
      ctx.checkActive();
      this.cleanupFn = result.value;
      // Return a promise that either never finishes (keeping this runId active)
      // Or resolves to the value given to ctx.deferred.resolve()
      return ctx.deferred.promise;
    }
    // In case of error in the setup, propagate the error immediately
    return result;
  }

  protected makeContext(runId: RunId): StatefulComputationCtx<S, E, R> {
    const state = this.config.initialState();
    const deferred = createDefer<Result<R>>();
    return {
      state,
      deferred,
      isActive: () => this.isActive(runId),
      checkActive: () => this.checkActive(runId),
      ...this.emitterMixin.makeContextRoutine(runId),
      ...this.observerMixin.makeContextRoutine(runId),
    };
  }

  private cleanup() {
    const { cleanupFn } = this;
    if (cleanupFn) {
      cleanupFn();
      this.cleanupFn = null;
    }
  }

  protected finishRoutine(result: Result<R>): void {
    this.cleanup();
  }

  protected invalidateRoutine(): void {
    this.cleanup();
    this.observerMixin.invalidateRoutine();
  }

  protected deleteRoutine(): void {
    this.cleanup();
    this.emitterMixin.deleteRoutine();
    this.observerMixin.deleteRoutine();
  }

  protected isOrphan(): boolean {
    return this.emitterMixin.isOrphan();
  }

  protected onStateChange(from: StateNotDeleted, to: StateNotCreating): void {}
}
