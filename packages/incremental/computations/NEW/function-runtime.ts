import { computeIfAbsent } from "../../../util/maps-sets";
import type { Version } from "../../utils/versions";
import { IncrementalCellDescription } from "./cells";
import { IncrementalCellRuntime } from "./cell-runtime";
import {
  IncrementalFunctionCallDescription,
  type CellValueDescriptions,
  type IncrementalFunctionSchema,
} from "./functions";
import type { ChangedValue, ValueOfDesc } from "./values";
import type { IncrementalBackend } from "./backend";
import { IncrementalComputationRuntime } from "./computation-runtime";

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
    value: ValueOfDesc<CellDefs[K]>
  ) {
    const cell = this.runtime.alloc(this, key);
    cell.set(value);
    return cell.desc;
  }

  read<Value>(desc: IncrementalCellDescription<Value>): Promise<Value> {
    const func = this.backend.get(desc.owner);
    const cell = desc.resolved
      ? func?.ownedCells.get(desc.key)?.array[desc.index]
      : func?.outputCell;
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
> extends IncrementalComputationRuntime<
  IncrementalContextRuntime<Input, Output, CellDefs>,
  Output
> {
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
    backend: IncrementalBackend,
    readonly desc: IncrementalFunctionCallDescription<Input, Output, CellDefs>
  ) {
    super(backend, desc);
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
    let cell: IncrementalCellRuntime<ValueOfDesc<CellDefs[K]>>;
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

  protected createContext(): IncrementalContextRuntime<
    Input,
    Output,
    CellDefs
  > {
    return new IncrementalContextRuntime(this.backend, this);
  }

  protected exec(ctx: IncrementalContextRuntime<Input, Output, CellDefs>) {
    return this.desc.schema.impl(ctx, this.desc.input);
  }

  protected setOutputValue(value: Output) {
    return this.outputCell.set(value);
  }

  protected finishRoutine(set: ChangedValue<Output>): void {}

  protected invalidateRoutine() {
    // Reset cells (but keep the instances for reuse)
    for (const slot of this.ownedCells.values()) {
      slot.activeLen = 0;
    }
    // Mark output cell as pending
    this.outputCell.setPending();
    // Clear the dependencies
    for (const cell of this.readCells.keys()) {
      cell.dependents.delete(this);
    }
    this.readCells.clear();
  }

  protected deleteRoutine() {}

  protected onStateChange(from: StateNotDeleted, to: StateNotCreating): void {}
}
