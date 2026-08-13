import type { MaybeAsync } from "../../util/miscellaneous";
import type { AnyIncrementalComputationDescription } from "../descriptions/computations";
import { type IncrementalBackend } from "./backend";
import { IncrementalCellOwner } from "./cell-owners";

export const PREV_COMPUTATION = Symbol("quase.incremental.prev.computation");
export const NEXT_COMPUTATION = Symbol("quase.incremental.next.computation");

export enum State {
  IDLE = 0,
  PENDING = 1,
  RUNNING = 2,
  SETTLED_ERR = 3,
  SETTLED_OK = 4,
  DELETED = 5,
}

export type StateNotDeleted =
  | State.IDLE
  | State.PENDING
  | State.RUNNING
  | State.SETTLED_ERR
  | State.SETTLED_OK;

export abstract class IncrementalComputationRuntime<
  Ctx,
  Output,
> extends IncrementalCellOwner {
  protected state: State;
  protected ctx: Ctx | null;
  protected running: Promise<void> | null;
  protected deleting: boolean;

  public readonly isCacheable: boolean;
  private reload: boolean;

  [PREV_COMPUTATION]: IncrementalComputationRuntime<any, any> | null = null;
  [NEXT_COMPUTATION]: IncrementalComputationRuntime<any, any> | null = null;

  constructor(
    backend: IncrementalBackend<any>,
    readonly desc1: AnyIncrementalComputationDescription
  ) {
    super(backend, desc1);
    this.state = State.IDLE;
    this.ctx = null;
    this.running = null;
    this.deleting = false;
    this.isCacheable = backend.db != null && desc1.isCacheable();
    this.reload = this.isCacheable;
    this.backend.computations[this.state].add(this);
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

  override onNeedChange(needed: boolean): void {
    if (needed) {
      if (this.state === State.IDLE) {
        this.mark(State.PENDING);
      }
    } else {
      if (this.state === State.PENDING) {
        this.mark(State.IDLE);
      }
    }
  }

  abstract setOutputValue(value: Output): void;

  protected abstract createContext(): Ctx;

  protected abstract exec(ctx: Ctx): MaybeAsync<Output>;

  run(): Promise<void> {
    this.inv();
    if (this.running == null) {
      const ctx = (this.ctx = this.createContext());
      this.running = this.runRoutine(ctx);
      this.mark(State.RUNNING);
    }
    return this.running;
  }

  private async runRoutine(ctx: Ctx): Promise<void> {
    try {
      // Attempt reload from cache
      if (this.reload) {
        this.reload = false;
        if (await this.reloadRoutine(ctx)) {
          this.finishReloaded(ctx);
          return;
        }
      }
      // Re-execute computation
      const v = await this.exec(ctx);
      this.finishOk(ctx, v);
    } catch (err: unknown) {
      this.finishErr(ctx, err);
    }
  }

  protected abstract reloadRoutine(ctx: Ctx): Promise<boolean>;

  protected abstract finishRoutine(): void;

  private finishReloaded(ctx: Ctx) {
    if (this.isActive(ctx)) {
      this.ctx = null;
      this.mark(State.SETTLED_OK);
    }
  }

  private finishOk(ctx: Ctx, value: Output) {
    if (this.isActive(ctx)) {
      this.ctx = null;
      this.setOutputValue(value);
      this.finishRoutine();
      this.mark(State.SETTLED_OK);
    }
  }

  private finishErr(ctx: Ctx, err: unknown) {
    if (this.isActive(ctx)) {
      this.ctx = null;
      this.mark(State.SETTLED_ERR);
      this.backend.onComputationError(this.desc1, err);
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
    // Do not reload later
    this.reload = false;
    // Invalidate routine
    this.invalidateRoutine();
    // If needed, mark as pending
    this.mark(this.isNeeded() ? State.PENDING : State.IDLE);
  }

  protected abstract invalidateRoutine(): void;

  delete() {
    this.inv();
    if (this.isNeeded()) {
      throw new Error(
        "Invariant violation: Some computation depends on this, cannot delete"
      );
    }
    this.ctx = null;
    this.running = null;
    this.reload = false;
    this.deleting = true;
    this.backend.deleteComputation(this);
    this.deleteRoutine();
    this.mark(State.DELETED);
  }

  protected abstract deleteRoutine(): void;

  demandAndWait(): Promise<void> {
    return this.run();
  }

  private mark(state: State) {
    const prevState = this.state;
    if (prevState === State.DELETED) {
      throw new Error("Invariant violation: Unexpected deleted computation");
    }
    this.backend.computations[prevState].delete(this);
    if (state !== State.DELETED) {
      this.backend.computations[state].add(this);
    }
    this.state = state;
    this.onStateChange(prevState, state);
    if (state === State.PENDING) {
      this.backend.scheduleWake();
    }
  }

  protected abstract onStateChange(from: StateNotDeleted, to: State): void;
}
