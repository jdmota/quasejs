import {
  ComputationRegistry,
  ComputationDescription,
  Result,
  error,
} from "../incremental-lib";

export enum State {
  PENDING = 0,
  RUNNING = 1,
  ERRORED = 2,
  DONE = 3,
  DELETED = 4,
  CREATING = 5,
}

export type StateNotCreating =
  | State.PENDING
  | State.RUNNING
  | State.ERRORED
  | State.DONE
  | State.DELETED;

export type StateNotDeleted =
  | State.PENDING
  | State.RUNNING
  | State.ERRORED
  | State.DONE
  | State.CREATING;

export type RunId = {
  readonly __opaque__: unique symbol;
};

function newRunId() {
  return {} as RunId;
}

export type AnyRawComputation = RawComputation<any, any>;

export abstract class RawComputation<Ctx, Res> {
  public readonly registry: ComputationRegistry;
  public readonly description: ComputationDescription<any>;
  // Current state
  private state: State;
  private runId: RunId | null;
  private running: Promise<Result<Res>> | null;
  // Latest result
  protected result: Result<Res> | null;
  // Requirements of SpecialQueue
  public prev: AnyRawComputation | null;
  public next: AnyRawComputation | null;

  constructor(
    registry: ComputationRegistry,
    description: ComputationDescription<any>,
    mark: boolean = true
  ) {
    this.registry = registry;
    this.description = description;
    this.state = State.CREATING;
    this.runId = null;
    this.running = null;
    this.result = null;
    this.prev = null;
    this.next = null;
    if (mark) this.mark(State.PENDING);
  }

  peekError() {
    if (this.result?.ok === false) {
      return this.result.error;
    }
    throw new Error("Assertion error: no error");
  }

  protected abstract exec(ctx: Ctx): Promise<Result<Res>>;
  protected abstract makeContext(runId: RunId): Ctx;
  protected abstract isOrphan(): boolean;

  protected inv() {
    if (this.state === State.DELETED) {
      throw new Error("Unexpected deleted computation");
    }
  }

  protected active(runId: RunId) {
    if (runId !== this.runId) {
      throw new Error("Computation was cancelled");
    }
  }

  protected onFinish(result: Result<Res>) {
    this.result = result;
  }

  private after(result: Result<Res>, runId: RunId): Result<Res> {
    if (this.runId === runId) {
      this.onFinish(result);
      this.mark(result.ok ? State.DONE : State.ERRORED);
    }
    return result;
  }

  protected async run(): Promise<Result<Res>> {
    this.inv();
    if (!this.running) {
      const { exec } = this;
      const runId = newRunId();
      this.runId = runId;
      this.running = exec(this.makeContext(runId)).then(
        v => this.after(v, runId),
        e => this.after(error(e), runId)
      );
      this.mark(State.RUNNING);
    }
    return this.running;
  }

  wait() {
    return this.running;
  }

  protected onInvalidate() {
    this.runId = null;
    this.running = null;
    this.result = null;
  }

  invalidate() {
    this.inv();
    this.onInvalidate();
    this.mark(State.PENDING);
  }

  protected onDeleted() {
    this.runId = null;
    this.running = null;
    this.result = null;
  }

  // pre: this.isOrphan()
  destroy() {
    this.inv();
    this.onDeleted();
    this.mark(State.DELETED);
  }

  protected abstract onStateChange(
    from: StateNotDeleted,
    to: StateNotCreating
  ): void;

  protected mark(state: StateNotCreating) {
    const prevState = this.state;
    if (prevState === State.DELETED) {
      throw new Error("Unexpected deleted computation");
    }
    if (prevState !== State.CREATING) {
      this.registry.computations[prevState].delete(this);
    }
    if (state === State.DELETED) {
      this.registry.delete(this);
    } else {
      this.registry.computations[state].add(this);
    }
    this.state = state;
    this.onStateChange(prevState, state);
  }

  maybeRun() {
    if (this.isOrphan()) {
      // this.destroy();
    } else {
      this.run();
    }
  }
}
