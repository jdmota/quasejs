import { computeIfAbsent } from "../../../util/maps-sets";
import type { Version } from "../../utils/versions";
import { IncrementalCellDescription } from "./cells";
import { IncrementalCellRuntime } from "./cell-runtime";
import {
  IncrementalFunctionCallDescription,
  type CellValueDescriptions,
  type IncrementalFunctionSchema,
} from "./functions";
import type { ValueOfDef } from "./values";
import type { IncrementalBackend } from "./backend";

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

export class IncrementalContextRuntime<
  Input,
  Output,
  CellDefs extends CellValueDescriptions,
> {
  constructor(
    private readonly backend: IncrementalBackend,
    private readonly runtime: IncrementalFunctionRuntime<
      Input,
      Output,
      CellDefs
    >
  ) {}

  isActive() {
    return this.runtime.isActive(this);
  }

  checkActive() {
    if (!this.isActive()) {
      throw new Error("Computation is not active");
    }
  }

  cell<K extends string & keyof CellDefs>(
    key: K,
    value: ValueOfDef<CellDefs[K]>
  ) {
    const cell = this.runtime.alloc(this, key);
    cell.set(value);
    return cell.desc;
  }

  read<Value>(desc: IncrementalCellDescription<Value>): Promise<Value> {
    const func = this.backend.make(desc.owner);
    const cell = desc.resolved
      ? func.ownedCells.get(desc.key)?.array[desc.index]
      : func.outputCell;
    if (!cell) {
      throw new Error(
        `Invariant violation: cell ${desc.getCacheKey()} does not exist`
      );
    }
    return cell.get(this, this.runtime);
  }

  call<Input, Output, CellDefs extends CellValueDescriptions>(
    schema: IncrementalFunctionSchema<Input, Output, CellDefs>,
    input: Input
  ) {
    const desc = new IncrementalFunctionCallDescription(schema, input);
    const func = this.backend.make(desc);
    return func.outputCell.desc;
  }
}

export class IncrementalFunctionRuntime<
  Input,
  Output,
  CellDefs extends CellValueDescriptions,
> {
  private state: State;
  private ctx: IncrementalContextRuntime<Input, Output, CellDefs> | null;
  private running: Promise<void> | null;
  private deleting: boolean;
  private dirty: boolean;
  private root: boolean;
  // Cells read and the oldest version which was read in this run
  readonly readCells: Map<IncrementalCellRuntime<any>, Version | null>;
  // Owned resolved cells
  readonly ownedCells: Map<
    string,
    { array: IncrementalCellRuntime<any>[]; activeLen: number }
  >;
  // Output cell
  readonly outputCell: IncrementalCellRuntime<Output>;

  constructor(
    private readonly backend: IncrementalBackend,
    readonly desc: IncrementalFunctionCallDescription<Input, Output, CellDefs>
  ) {
    this.root = false;
    this.state = State.CREATING;
    this.ctx = null;
    this.running = null;
    this.deleting = false;
    this.dirty = true;
    this.readCells = new Map();
    this.ownedCells = new Map();
    this.outputCell = new IncrementalCellRuntime(
      backend,
      this,
      desc.schema.outputDef,
      "",
      0,
      false
    );
  }

  alloc<K extends string & keyof CellDefs>(
    ctx: IncrementalContextRuntime<Input, Output, CellDefs>,
    key: K
  ) {
    ctx.checkActive();
    const valDef = this.desc.schema.cellsDef[key];
    if (!valDef) {
      throw new Error(`Cannot alloc cell with unregistered key ${key}`);
    }
    const slot = computeIfAbsent(this.ownedCells, key, () => ({
      array: [],
      activeLen: 0,
    }));
    let cell: IncrementalCellRuntime<ValueOfDef<CellDefs[K]>>;
    if (slot.activeLen < slot.array.length) {
      // Reusing the cell created in the last run
      cell = slot.array[slot.activeLen - 1];
    } else {
      // We need to create a new cell instance
      cell = new IncrementalCellRuntime(
        this.backend,
        this,
        valDef,
        key,
        slot.activeLen,
        true
      );
      slot.array.push(cell);
    }
    slot.activeLen++;
    return cell;
  }

  protected isDeleting() {
    return this.deleting;
  }

  protected getState() {
    return this.state;
  }

  isActive(ctx: IncrementalContextRuntime<Input, Output, CellDefs>) {
    return this.ctx === ctx;
  }

  inv() {
    if (this.isDeleting()) {
      throw new Error("Invariant violation: Unexpected deleted computation");
    }
  }

  setDirty() {
    this.dirty = true;
  }

  init(root: boolean) {
    this.root = root;
    this.mark(State.PENDING);
    return this;
  }

  run() {
    this.inv();
    if (this.running == null) {
      this.outputCell.setPending();
      const ctx = (this.ctx = new IncrementalContextRuntime(
        this.backend,
        this
      ));
      this.running = Promise.resolve()
        .then(() => this.desc.schema.impl(ctx, this.desc.input))
        .then(
          v => this.finishOk(ctx, v),
          e => this.finishErr(ctx, e)
        );
      this.mark(State.RUNNING);
    }
    return this.running;
  }

  private finishOk(
    ctx: IncrementalContextRuntime<Input, Output, CellDefs>,
    value: Output
  ) {
    if (ctx.isActive()) {
      this.ctx = null;
      this.dirty = false;
      this.mark(State.SETTLED_OK);
      this.outputCell.set(value);
    }
  }

  private finishErr(
    ctx: IncrementalContextRuntime<Input, Output, CellDefs>,
    err: any
  ) {
    if (ctx.isActive()) {
      this.ctx = null;
      this.dirty = false;
      this.mark(State.SETTLED_ERR);
      this.backend.onFunctionError(this.desc, err);
    }
  }

  invalidate() {
    this.inv();
    if (!this.registry.invalidationsAllowed()) {
      throw new Error("Invariant violation: Invalidations are disabled");
    }
    this.ctx = null;
    this.running = null;
    for (const slot of this.ownedCells.values()) {
      slot.activeLen = 0;
    }
    this.readCells.clear(); // TODO clear in both directions
    // this.invalidateRoutine();
    this.mark(State.PENDING);
    this.registry.scheduleWake();
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
    this.ctx = null;
    this.running = null;
    // this.deleteRoutine();
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

  protected onStateChange(from: StateNotDeleted, to: StateNotCreating): void {}
}
