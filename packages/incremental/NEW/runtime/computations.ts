import type { MaybeAsync } from "../../../util/miscellaneous";
import type { IncrementalCellDescription } from "../descriptions/cells";
import type { AnyIncrementalComputationDescription } from "../descriptions/computations";
import type { ChangedValue } from "../descriptions/values";
import type { IncrementalBackend } from "./backend";
import type { IncrementalCellOwner, IncrementalCellRuntime } from "./cells";

export enum State {
  PENDING = 0,
  RUNNING = 1,
  SETTLED_ERR = 2,
  SETTLED_OK = 3,
  DELETED = 4,
  CREATING = 5,
}

export type StateNotCreating =
  | State.PENDING
  | State.RUNNING
  | State.SETTLED_ERR
  | State.SETTLED_OK
  | State.DELETED;

export type StateNotDeleted =
  | State.PENDING
  | State.RUNNING
  | State.SETTLED_ERR
  | State.SETTLED_OK
  | State.CREATING;

export abstract class IncrementalComputationRuntime<Ctx, Output>
  implements IncrementalCellOwner
{
  protected state: State;
  protected ctx: Ctx | null;
  protected running: Promise<void> | null;
  protected deleting: boolean;
  protected root: boolean;

  next: IncrementalComputationRuntime<any, any> | null = null;
  prev: IncrementalComputationRuntime<any, any> | null = null;

  constructor(
    protected readonly backend: IncrementalBackend,
    readonly rawDesc: AnyIncrementalComputationDescription
  ) {
    this.root = false;
    this.state = State.CREATING;
    this.ctx = null;
    this.running = null;
    this.deleting = false;
  }

  protected isDeleting() {
    return this.deleting;
  }

  protected getState() {
    return this.state;
  }

  isActive(ctx: Ctx) {
    return this.ctx === ctx;
  }

  inv() {
    if (this.deleting) {
      throw new Error("Invariant violation: Unexpected deleted computation");
    }
  }

  init(root: boolean) {
    this.root = root;
    this.mark(State.PENDING);
    return this;
  }

  abstract getCell<Value>(
    desc: IncrementalCellDescription<Value>
  ): IncrementalCellRuntime<Value> | undefined;

  abstract onReadCell<Value>(cell: IncrementalCellRuntime<Value>): void;

  protected abstract createContext(): Ctx;

  protected abstract exec(ctx: Ctx): MaybeAsync<Output>;

  run() {
    this.inv();
    if (this.running == null) {
      const ctx = (this.ctx = this.createContext());
      this.running = Promise.resolve()
        .then(() => this.exec(ctx))
        .then(
          v => this.finishOk(ctx, v),
          e => this.finishErr(ctx, e)
        );
      this.mark(State.RUNNING);
    }
    return this.running;
  }

  protected abstract setOutputValue(value: Output): ChangedValue<Output>;

  private finishOk(ctx: Ctx, value: Output) {
    if (this.isActive(ctx)) {
      this.ctx = null;
      this.finishRoutine(this.setOutputValue(value));
      this.mark(State.SETTLED_OK);
    }
  }

  protected abstract finishRoutine(set: ChangedValue<Output>): void;

  private finishErr(ctx: Ctx, err: any) {
    if (this.isActive(ctx)) {
      this.ctx = null;
      this.mark(State.SETTLED_ERR);
      this.backend.onFunctionError(this.rawDesc, err);
    }
  }

  invalidate() {
    this.inv();
    if (!this.backend.invalidationsAllowed()) {
      throw new Error("Invariant violation: Invalidations are disabled");
    }
    // Invalidate last run
    this.ctx = null;
    // Clear last run promise
    this.running = null;
    // Invalidate routine
    this.invalidateRoutine();
    // Mark as pending and schedule execution
    this.mark(State.PENDING);
    this.backend.scheduleWake();
  }

  protected abstract invalidateRoutine(): void;

  destroy() {
    this.inv();
    if (!this.isAlone()) {
      throw new Error(
        "Invariant violation: Some computation depends on this, cannot destroy"
      );
    }
    this.ctx = null;
    this.running = null;
    this.deleting = true;
    this.backend.delete(this);
    this.deleteRoutine();
    this.mark(State.DELETED);
  }

  protected abstract deleteRoutine(): void;

  protected abstract isAlone(): boolean;

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

  private mark(state: StateNotCreating) {
    const prevState = this.state;
    if (prevState === State.DELETED) {
      throw new Error("Invariant violation: Unexpected deleted computation");
    }
    if (prevState !== State.CREATING) {
      this.backend.computations[prevState].delete(this);
    }
    if (state !== State.DELETED) {
      this.backend.computations[state].add(this);
    }
    this.state = state;
    this.onStateChange(prevState, state);
  }

  protected abstract onStateChange(
    from: StateNotDeleted,
    to: StateNotCreating
  ): void;
}
