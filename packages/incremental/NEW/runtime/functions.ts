import { type ILogger, ContextualLogger } from "../../../util/logger";
import { computeIfAbsent } from "../../../util/maps-sets";
import type { Version } from "../../utils/versions";
import { CacheableComputationMixin } from "../cache/cacheable";
import { IncrementalCellDescription } from "../descriptions/cells";
import {
  type CellValueDescriptions,
  type IncrementalFunctionSchema,
  IncrementalFunctionCallDescription,
} from "../descriptions/functions";
import type { ValueOfDesc } from "../descriptions/values";
import type { FileChange } from "../file-system/file-system";
import type { IncrementalBackend } from "./backend";
import { IncrementalCellRuntime } from "./cells";
import {
  type StateNotDeleted,
  type StateNotCreating,
  IncrementalComputationRuntime,
} from "./computations";

export async function waitForCell<Value>(
  backend: IncrementalBackend,
  logger: ILogger,
  desc: IncrementalCellDescription<Value>
): Promise<IncrementalCellRuntime<Value> | undefined> {
  const cellOwner = backend.getCellOwner(desc.owner);
  if (!cellOwner) {
    logger.warn(`Could not create or find cell owner ${desc.owner.format()}`);
  }
  let cell = cellOwner.getCell(desc);
  if (!cell) {
    // If the cell does not exist yet, wait for the computation to finish
    await cellOwner.run();
  }
  cell = cellOwner.getCell(desc);
  if (!cell) {
    logger.warn(`Could not find cell ${desc.format()}`);
  }
  return cell;
}

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

  // TODO allow to allocate cell, and fill it later
  cell<K extends string & keyof CellDefs>(
    key: K,
    value: ValueOfDesc<CellDefs[K]>
  ) {
    const cell = this.runtime.alloc(this, key);
    cell.set(value);
    return cell.desc;
  }

  async read<Value>(desc: IncrementalCellDescription<Value>): Promise<Value> {
    const cell = await waitForCell(this.backend, this.runtime.logger, desc);
    if (!cell) {
      throw new Error(`Cell ${desc.getCacheKey()} does not exist`);
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
    const func = this.backend.getFunction(desc);
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
  readonly logger: ContextualLogger;
  // Cells read and the oldest version which was read in this run
  readonly readCells: Map<IncrementalCellRuntime<any>, Version | null>;
  // Owned resolved cells
  readonly ownedCells: Map<
    string,
    { array: IncrementalCellRuntime<any>[]; activeLen: number }
  >;
  // Cacheable mixin
  readonly cacheableMixin: CacheableComputationMixin<this> | null;

  constructor(
    backend: IncrementalBackend,
    readonly desc: IncrementalFunctionCallDescription<Input, Output, CellDefs>
  ) {
    super(backend, desc);
    this.logger = new ContextualLogger(
      this.backend.logger,
      `function > ${this.desc.format()}`
    );
    this.cacheableMixin = this.isCacheable
      ? new CacheableComputationMixin(this)
      : null;
    this.readCells = new Map();
    this.ownedCells = new Map();
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

  allocSlot(key: string) {
    return computeIfAbsent(this.ownedCells, key, () => ({
      array: [],
      activeLen: 0,
    }));
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
    const slot = this.allocSlot(key);
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
    this.logger.debug("Executing...");
    return this.desc.schema.impl(ctx, this.desc.input);
  }

  protected reloadRoutine(
    ctx: IncrementalContextRuntime<Input, Output, CellDefs>
  ) {
    this.logger.debug("Reloading...");
    return this.cacheableMixin!.reloadRoutine(ctx);
  }

  protected finishRoutine() {
    // Warn the user if there are pending reads
    for (const [cell, version] of this.readCells) {
      if (version == null) {
        this.logger.warn(`Pending read ${cell.desc.format()}`);
      }
    }
    // Delete cells that were not reused in this run
    for (const slot of this.ownedCells.values()) {
      for (let i = slot.activeLen; i < slot.array.length; i++) {
        slot.array[i].setDeleted();
      }
      slot.array.length = slot.activeLen;
    }
    this.cacheableMixin?.finishRoutine();
  }

  protected invalidateRoutine() {
    // Reset cells (but keep the instances for reuse)
    for (const slot of this.ownedCells.values()) {
      slot.activeLen = 0;
    }
    // Clear the dependencies
    for (const cell of this.readCells.keys()) {
      cell.dependents.delete(this);
    }
    this.readCells.clear();
  }

  protected deleteRoutine() {
    this.cacheableMixin?.deleteRoutine();
  }

  override isOrphan(): boolean {
    // TODO
    return false;
  }

  protected onStateChange(from: StateNotDeleted, to: StateNotCreating) {}
}
