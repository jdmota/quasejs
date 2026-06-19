import type { MaybeAsync } from "../../../util/miscellaneous";
import type { IncrementalCellDescription } from "../descriptions/cells";
import type { AnyIncrementalComputationDescription } from "../descriptions/computations";
import type { IncrementalBackend } from "./backend";
import { type IncrementalCellOwner, IncrementalCellRuntime } from "./cells";

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

export type ResultTypeOfComputation<C> =
  C extends IncrementalComputationRuntime<any, infer Output> ? Output : never;

export abstract class IncrementalComputationRuntime<Ctx, Output>
  implements IncrementalCellOwner
{
  protected root: boolean;
  protected state: State;
  protected ctx: Ctx | null;
  protected running: Promise<void> | null;
  protected deleting: boolean;

  public readonly isCacheable: boolean;
  private reload: boolean;

  // Output cell
  readonly outputCell: IncrementalCellRuntime<Output>;

  next: IncrementalComputationRuntime<any, any> | null = null;
  prev: IncrementalComputationRuntime<any, any> | null = null;

  constructor(
    readonly backend: IncrementalBackend,
    readonly rawDesc: AnyIncrementalComputationDescription
  ) {
    this.root = false;
    this.state = State.CREATING;
    this.ctx = null;
    this.running = null;
    this.deleting = false;
    this.isCacheable = backend.db != null && rawDesc.isCacheable();
    this.reload = this.isCacheable;
    this.outputCell = new IncrementalCellRuntime(
      backend,
      this,
      rawDesc.getOutputDef(),
      "",
      0,
      false
    );
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
    this.markRoot(root);
    this.mark(State.PENDING);
    return this;
  }

  markRoot(root: boolean) {
    this.root = root;
  }

  isRoot() {
    return this.root;
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
      this.outputCell.set(value);
      this.finishRoutine();
      this.mark(State.SETTLED_OK);
    }
  }

  private finishErr(ctx: Ctx, err: unknown) {
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
    // Do not reload later
    this.reload = false;
    // Set output cell to pending
    this.outputCell.setPending();
    // Invalidate routine
    this.invalidateRoutine();
    // Mark as pending and schedule execution
    this.mark(State.PENDING);
    this.backend.scheduleWake();
  }

  protected abstract invalidateRoutine(): void;

  destroy() {
    this.inv();
    if (!this.isOrphan()) {
      throw new Error(
        "Invariant violation: Some computation depends on this, cannot destroy"
      );
    }
    this.ctx = null;
    this.running = null;
    this.reload = false;
    this.deleting = true;
    this.backend.delete(this);
    this.deleteRoutine();
    this.mark(State.DELETED);
  }

  protected abstract deleteRoutine(): void;

  abstract isOrphan(): boolean;

  maybeRun() {
    if (this.state === State.PENDING && !this.isOrphan()) {
      this.run();
      return true;
    }
    return false;
  }

  maybeDestroy() {
    if (this.isOrphan()) {
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
