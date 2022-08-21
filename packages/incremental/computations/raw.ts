import { Result, error } from "../utils/result";
import {
  ComputationRegistry,
  ComputationDescription,
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

enum Reachability {
  UNCONNECTED = 0,
  CONNECTED = 1,
  UNKNOWN = 2,
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
  // Reachability
  private reachability: Reachability;

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
    this.reachability = this.isRoot()
      ? Reachability.CONNECTED
      : Reachability.UNCONNECTED;
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
  protected abstract onStateChange(
    from: StateNotDeleted,
    to: StateNotCreating
  ): void;
  protected abstract finishRoutine(result: Result<Res>): void;
  protected abstract invalidateRoutine(): void;
  protected abstract deleteRoutine(): void;

  isRoot() {
    return false;
  }

  // TODO fixme, this is not enough info... we might think it is connected because of another node... but that node might become unreachable...

  onInEdgeAddition(node: AnyRawComputation) {
    // Maybe this new edge connected the computation to the root
    if (this.reachability === Reachability.UNCONNECTED) {
      this.reachability = Reachability.UNKNOWN;
    }
    // If it was connected, it remains connected
    // If unknown, it remains unknown
  }

  onInEdgeRemoval(node: AnyRawComputation) {
    // Maybe this removed edge unconnected the computation to the root
    if (this.reachability === Reachability.CONNECTED) {
      this.reachability = Reachability.UNKNOWN;
    }
    // If it was unconnected, it remains unconnected
    // If unknown, it remains unknown
  }

  protected abstract inEdgesRoutine(): IterableIterator<AnyRawComputation>;
  protected abstract outEdgesRoutine(): IterableIterator<AnyRawComputation>;

  inEdges() {
    return this.inEdgesRoutine();
  }

  outEdges() {
    return this.outEdgesRoutine();
  }

  protected deleted() {
    return this.state === State.DELETED;
  }

  inv() {
    if (this.deleted()) {
      throw new Error("Unexpected deleted computation");
    }
  }

  active(runId: RunId) {
    if (runId !== this.runId) {
      throw new Error("Computation was cancelled");
    }
  }

  private after(result: Result<Res>, runId: RunId): Result<Res> {
    if (this.runId === runId) {
      this.result = result;
      this.finishRoutine(result);
      this.mark(result.ok ? State.DONE : State.ERRORED);
    }
    return result;
  }

  async run(): Promise<Result<Res>> {
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

  invalidate() {
    this.inv();
    this.runId = null;
    this.running = null;
    this.result = null;
    this.invalidateRoutine();
    this.mark(State.PENDING);
  }

  // pre: this.isOrphan()
  destroy() {
    this.inv();
    this.runId = null;
    this.running = null;
    this.result = null;
    this.deleteRoutine();
    this.mark(State.DELETED);
  }

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
