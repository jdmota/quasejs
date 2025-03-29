import {
  ComputationDescription,
  ComputationRegistry,
} from "../incremental-lib";
import { ComputationResult } from "../utils/result";
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

type StatefulComputationCtx<S, E> = {
  readonly isActive: () => void;
  readonly checkActive: () => void;
  readonly state: S;
} & EmitterContext<E> &
  ObserverContext;

export type AnyStatefulComputation = StatefulComputation<any, any, any>;

type StatefulComputationExec<S, E, R> = (
  ctx: StatefulComputationCtx<S, E>
) => Promise<ComputationResult<R>>;

type StatefulComputationConfig<S, E, R> = {
  readonly initialState: () => S;
  readonly exec: StatefulComputationExec<S, E, R>;
  readonly cleanup: (ctx: StatefulComputationCtx<S, E>) => Promise<void>;
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
      this.config.cleanup === other.config.cleanup &&
      this.config.initialState === other.config.initialState
    );
  }

  hash() {
    return 0;
  }

  serializer() {
    return null;
  }
}

export class StatefulComputation<S, E, R>
  extends RawComputation<StatefulComputationCtx<S, E>, R>
  implements EmitterComputation<E>, ObserverComputation
{
  readonly emitterMixin: EmitterComputationMixin<E>;
  readonly observerMixin: ObserverComputationMixin;

  private readonly config: StatefulComputationConfig<S, E, R>;

  constructor(
    registry: ComputationRegistry,
    description: StatefulComputationDescription<S, E, R>
  ) {
    super(registry, description, false);
    this.emitterMixin = new EmitterComputationMixin(this);
    this.observerMixin = new ObserverComputationMixin(this);
    this.config = description.config;
    this.mark(State.PENDING);
  }

  protected async exec(
    ctx: StatefulComputationCtx<S, E>
  ): Promise<ComputationResult<R>> {
    try {
      // Execute this computation
      return await this.config.exec(ctx);
    } finally {
      // Clean up this run
      // Even if this computation were to be invalidated in the middle of a run,
      // this will execute eventually anyway
      await this.config.cleanup(ctx);
    }
  }

  protected makeContext(runId: RunId): StatefulComputationCtx<S, E> {
    const state = this.config.initialState();
    return {
      state,
      isActive: () => this.isActive(runId),
      checkActive: () => this.checkActive(runId),
      ...this.observerMixin.makeContextRoutine(runId),
      ...this.emitterMixin.makeContextRoutine(),
    };
  }

  // TODO work more on the idea of events and stateful computations, and how to cancel stuff or interrupt in the middle
  // TODO can we emit or observe/unobserve outside of the time frame of a run?
  // TODO allow to consume events with an async generator
  getAllPastEvents(): IterableIterator<E> {
    throw new Error("Method not implemented.");
  }

  protected finishRoutine(result: ComputationResult<R>): void {}

  protected invalidateRoutine(): void {
    this.observerMixin.invalidateRoutine();
  }

  protected deleteRoutine(): void {
    this.emitterMixin.deleteRoutine();
    this.observerMixin.deleteRoutine();
  }

  protected isOrphan(): boolean {
    return this.emitterMixin.isOrphan();
  }

  protected onStateChange(from: StateNotDeleted, to: StateNotCreating): void {}
}
