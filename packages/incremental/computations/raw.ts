import {
  CachedResult,
  ComputationResult,
  error,
  VersionedComputationResult,
  WrappedResult,
} from "../utils/result";
import {
  ComputationRegistry,
  ComputationDescription,
} from "../incremental-lib";

export enum State {
  PENDING = 0,
  RUNNING = 1,
  SETTLED_UNSTABLE = 2,
  SETTLED_STABLE = 3,
  DELETED = 4,
  CREATING = 5,
}

export type StateNotCreating =
  | State.PENDING
  | State.RUNNING
  | State.SETTLED_UNSTABLE
  | State.SETTLED_STABLE
  | State.DELETED;

export type StateNotDeleted =
  | State.PENDING
  | State.RUNNING
  | State.SETTLED_UNSTABLE
  | State.SETTLED_STABLE
  | State.CREATING;

export type RawComputationContext = {
  readonly version: number;
  readonly checkActive: () => void;
};

export type RawComputationExec<Ctx, Res> = (
  ctx: Ctx
) => Promise<ComputationResult<Res>>;

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
  private runVersion: number;
  private running: Promise<VersionedComputationResult<Res>> | null;
  private deleting: boolean;
  // Latest result
  protected result: VersionedComputationResult<Res> | null;
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
    this.runVersion = 0;
    this.running = null;
    this.deleting = false;
    this.result = null;
    this.prev = null;
    this.next = null;
    if (mark) this.mark(State.PENDING);
  }

  peekResult() {
    if (this.result) {
      return this.result.result;
    }
    throw new Error("Invariant violation: no result");
  }

  peekError() {
    if (this.result?.result.ok === false) {
      return this.result.result;
    }
    throw new Error("Invariant violation: no error");
  }

  protected abstract exec(ctx: Ctx): Promise<ComputationResult<Res>>;
  protected abstract makeContext(runId: RunId, runVersion: number): Ctx;
  protected abstract isOrphan(): boolean;
  protected abstract onStateChange(
    from: StateNotDeleted,
    to: StateNotCreating
  ): void;
  protected abstract finishRoutine(result: ComputationResult<Res>): void;
  protected abstract invalidateRoutine(): void;
  protected abstract deleteRoutine(): void;
  //protected abstract inNodesRoutine(): IterableIterator<AnyRawComputation>;
  //protected abstract outNodesRoutine(): IterableIterator<AnyRawComputation>;

  /*inNodes() {
    return this.inNodesRoutine();
  }

  outNodes() {
    return this.outNodesRoutine();
  }*/

  onInEdgeAddition(node: AnyRawComputation) {}

  onInEdgeRemoval(node: AnyRawComputation) {}

  protected isDeleting() {
    return this.deleting;
  }

  protected getState() {
    return this.state;
  }

  inv() {
    if (this.isDeleting()) {
      throw new Error("Invariant violation: Unexpected deleted computation");
    }
  }

  isActive(runId: RunId) {
    return runId === this.runId;
  }

  checkActive(runId: RunId) {
    if (!this.isActive(runId)) {
      throw new Error("Computation not active");
    }
  }

  run(): Promise<VersionedComputationResult<Res>> {
    this.inv();
    if (!this.running) {
      const runId = newRunId();
      const runVersion = this.runVersion + 1;
      const ctx = this.makeContext(runId, runVersion);
      this.runId = runId;
      this.runVersion = runVersion;
      this.running = Promise.resolve()
        .then(() => this.exec(ctx))
        .then(
          v => this.finish(v, runId, runVersion),
          e => {
            if (e instanceof WrappedResult) {
              return this.finish(e.result, runId, runVersion);
            }
            if (e instanceof CachedResult) {
              return this.finish(e.result, runId, e.version);
            }
            return this.finish(error(e, false), runId, runVersion);
          }
        );
      this.mark(State.RUNNING);
    }
    return this.running;
  }

  private finish(
    result: ComputationResult<Res>,
    runId: RunId,
    runVersion: number
  ): VersionedComputationResult<Res> {
    if (this.isActive(runId)) {
      const versionedResult: VersionedComputationResult<Res> = {
        version: runVersion,
        result,
      };
      this.runId = null;
      this.result = versionedResult;
      this.finishRoutine(result);
      this.mark(
        result.ok || result.deterministic
          ? State.SETTLED_STABLE
          : State.SETTLED_UNSTABLE
      );
      return versionedResult;
    }
    return {
      version: runVersion,
      result: error(new Error("Computation was cancelled"), false),
    };
  }

  invalidate() {
    this.inv();
    if (!this.registry.invalidationsAllowed()) {
      throw new Error("Invariant violation: Invalidations are disabled");
    }
    this.runId = null;
    this.running = null;
    this.result = null;
    this.invalidateRoutine();
    this.mark(State.PENDING);
    this.registry.scheduleWake();
  }

  destroy() {
    this.inv();
    if (!this.isOrphan()) {
      throw new Error(
        "Invariant violation: Some computation depends on this, cannot destroy"
      );
    }
    this.registry.delete(this); // Remove immediately from registry to be safe
    this.deleting = true;
    this.runId = null;
    this.running = null;
    this.result = null;
    this.deleteRoutine();
    this.mark(State.DELETED);
  }

  protected mark(state: StateNotCreating) {
    const prevState = this.state;
    if (prevState === State.DELETED) {
      throw new Error("Invariant violation: Unexpected deleted computation");
    }
    if (prevState !== State.CREATING) {
      this.registry.computations[prevState].delete(this);
    }
    if (state !== State.DELETED) {
      this.registry.computations[state].add(this);
    }
    this.state = state;
    this.onStateChange(prevState, state);
  }

  maybeRun() {
    if (this.state === State.PENDING && !this.isOrphan()) {
      this.run();
    }
  }

  maybeDestroy() {
    if (this.isOrphan()) {
      this.destroy();
    }
  }
}
