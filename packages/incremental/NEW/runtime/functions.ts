import { computeIfAbsent } from "../../../util/maps-sets";
import type { Version } from "../../utils/versions";
import { IncrementalCellDescription } from "../descriptions/cells";
import {
  type CellValueDescriptions,
  type IncrementalFunctionSchema,
  IncrementalFunctionCallDescription,
} from "../descriptions/functions";
import type { ChangedValue, ValueOfDesc } from "../descriptions/values";
import type { FileChange } from "../file-system/file-system";
import type { IncrementalBackend } from "./backend";
import { IncrementalCellRuntime } from "./cells";
import {
  type StateNotDeleted,
  type StateNotCreating,
  IncrementalComputationRuntime,
} from "./computations";

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
    const cell = this.backend.getCell(desc);
    if (!cell) {
      throw new Error(
        `Invariant violation: cell ${desc.getCacheKey()} does not exist`
      );
    }
    return cell.get(this, this.runtime);
  }

  // Internal direct access
  _read<Value>(cell: IncrementalCellRuntime<Value>): Promise<Value> {
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

  fs<T>(
    originalPath: string,
    fn: (path: string) => T | Promise<T>,
    type: FileChange | null = null,
    rec: boolean = false
  ) {
    return this.backend.fs.depend(this, originalPath, fn, type, rec);
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

  override getCell<Value>(
    desc: IncrementalCellDescription<Value>
  ): IncrementalCellRuntime<Value> | undefined {
    const cell = desc.resolved
      ? this.ownedCells.get(desc.key)?.array[desc.index]
      : this.outputCell;
    return cell as any;
  }

  override onReadCell<Value>(cell: IncrementalCellRuntime<Value>) {
    if (!cell.desc.resolved) {
      // Ensure progress
      this.maybeRun();
    }
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

  protected override isAlone(): boolean {
    // TODO
    return false;
  }

  protected setOutputValue(value: Output) {
    return this.outputCell.set(value);
  }

  protected finishRoutine(set: ChangedValue<Output>) {}

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

  protected onStateChange(from: StateNotDeleted, to: StateNotCreating) {}
}
