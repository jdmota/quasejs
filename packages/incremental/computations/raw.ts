import { createDefer, type Defer } from "../../util/deferred";
import { assertion, nonNull } from "../../util/miscellaneous";
import {
  type ComputationResult,
  error,
  type VersionedComputationResult,
  WrappedResult,
} from "../utils/result";
import { RunId } from "../utils/run-id";
import { type ComputationRegistry } from "../incremental-lib";
import { ComputationDescription } from "./description";

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
  readonly checkActive: () => void;
};

export type RawComputationExec<Ctx, Res> = (
  ctx: Ctx
) => Promise<ComputationResult<Res>>;

export type AnyRawComputation = RawComputation<any, any>;

export abstract class RawComputation<Ctx, Res> {
  public readonly registry: ComputationRegistry<any>;
  public readonly description: ComputationDescription<any>;
  // Current state
  private state: State;
  private runId: RunId;
  private nextVersion: number;
  private running: Defer<VersionedComputationResult<Res>> | null;
  private deleting: boolean;
  private root: boolean;
  // Latest result
  protected result: VersionedComputationResult<Res> | null;
  // Requirements of SpecialQueue
  public prev: AnyRawComputation | null;
  public next: AnyRawComputation | null;

  constructor(
    registry: ComputationRegistry<any>,
    description: ComputationDescription<any>
  ) {
    this.registry = registry;
    this.description = description;
    this.root = false;
    this.state = State.CREATING;
    this.runId = new RunId();
    this.nextVersion = 1;
    this.running = null;
    this.deleting = false;
    this.result = null;
    this.prev = null;
    this.next = null;
  }

  init(root: boolean) {
    this.root = root;
    this.mark(State.PENDING);
    return this;
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

  isRoot() {
    return this.root;
  }

  setRoot(root: boolean) {
    this.root = root;
  }

  protected abstract exec(
    ctx: Ctx,
    runId: number
  ): Promise<ComputationResult<Res>>;
  protected abstract makeContext(runId: number): Ctx;
  protected abstract isOrphan(): boolean;
  protected abstract onStateChange(
    from: StateNotDeleted,
    to: StateNotCreating
  ): void;
  protected abstract finishRoutine(
    result: VersionedComputationResult<Res>
  ): VersionedComputationResult<Res>;
  protected abstract invalidateRoutine(): void;
  protected abstract deleteRoutine(): void;
  abstract responseEqual(a: Res, b: Res): boolean;

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

  checkActive(runId: number) {
    if (this.runId.isNotActive(runId)) {
      throw new Error("Computation not active");
    }
  }

  run(): Promise<VersionedComputationResult<Res>> {
    this.inv();
    if (this.state === State.PENDING) {
      if (this.running == null) {
        this.running = createDefer();
      }
      assertion(!this.running.isFulfilled());
      const runId = this.runId.newId();
      const ctx = this.makeContext(runId);
      Promise.resolve()
        .then(() => this.exec(ctx, runId))
        .then(
          v => this.finish(v, runId),
          e => {
            if (e instanceof WrappedResult) {
              this.finish(e.result, runId);
            } else {
              this.finish(error(e, false), runId);
            }
          }
        );
      this.mark(State.RUNNING);
    }
    return nonNull(this.running).promise;
  }

  private finish(result: ComputationResult<Res>, runId: number) {
    if (this.runId.isActive(runId)) {
      this.runId.cancel();
      this.result = this.finishRoutine({
        version: [this.registry.getSession(), this.nextVersion++],
        result,
      });
      nonNull(this.running).resolve(this.result);
      if (this.root) {
        this.registry.onRootResult(this.result);
      }
      this.mark(
        result.ok || result.deterministic
          ? State.SETTLED_STABLE
          : State.SETTLED_UNSTABLE
      );
    }
  }

  checkResult(result: VersionedComputationResult<Res>) {
    return this.result === result;
  }

  invalidate() {
    this.inv();
    if (!this.registry.invalidationsAllowed()) {
      throw new Error("Invariant violation: Invalidations are disabled");
    }
    this.runId.cancel();
    if (this.running?.isFulfilled()) this.running = null;
    this.result = null;
    this.invalidateRoutine();
    this.mark(State.PENDING);
    this.registry.scheduleWake();
  }

  private isAlone() {
    return !this.root && this.isOrphan();
  }

  destroy() {
    this.inv();
    if (!this.isAlone()) {
      throw new Error(
        "Invariant violation: Some computation depends on this, cannot destroy"
      );
    }
    this.registry.delete(this); // Remove immediately from registry to be safe
    this.deleting = true;
    this.runId.cancel();
    this.running = null;
    this.result = null;
    this.deleteRoutine();
    this.mark(State.DELETED);
  }

  private mark(state: StateNotCreating) {
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
    if (this.state === State.PENDING && !this.isAlone()) {
      this.run();
      return true;
    }
    return false;
  }

  maybeDestroy() {
    if (this.isAlone()) {
      this.destroy();
    }
  }
}
