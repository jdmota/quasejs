import { type Logger } from "../../../util/logger";
import { computeIfAbsent } from "../../../util/maps-sets";
import { $FORMAT } from "../../../util/values";
import type { Version } from "../../utils/versions";
import { CacheableComputationMixin } from "../cache/cacheable";
import {
  type ResultOfCellDesc,
  IncrementalAllocatedCellDescription,
  IncrementalCellDescription,
  IncrementalOutputCellDescription,
} from "../descriptions/cells";
import {
  type CellsTypes,
  type IncrementalFunctionSchema,
  IncrementalFunctionCallDescription,
} from "../descriptions/functions";
import type { FileChange } from "../file-system/file-system";
import type { IncrementalBackend } from "./backend";
import { IncrementalCellRuntime } from "./cells";
import {
  type StateNotDeleted,
  type StateNotCreating,
  IncrementalComputationRuntime,
} from "./computations";

export async function waitForCell<Desc extends IncrementalCellDescription<any>>(
  backend: IncrementalBackend,
  logger: Logger,
  desc: Desc
): Promise<IncrementalCellRuntime<Desc> | undefined> {
  const owner = backend.getCellOwner(desc.owner0);
  let cell = owner.getCell(desc);
  if (!cell) {
    // If the cell does not exist yet, wait for the computation to finish
    await owner.demandAndWait();
  }
  cell = owner.getCell(desc);
  if (!cell) {
    logger.debug(`Could not find cell ${desc[$FORMAT]()}`);
  }
  return cell;
}

export class IncrementalContextRuntime<
  Input,
  Output,
  Cells extends CellsTypes,
> {
  constructor(
    private readonly backend: IncrementalBackend,
    private readonly runtime: IncrementalFunctionRuntime<Input, Output, Cells>
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
  cell<K extends string & keyof Cells>(key: K, value: Cells[K]) {
    const cell = this.runtime.alloc(this, key);
    cell.set(value);
    return cell.desc;
  }

  async read<Desc extends IncrementalCellDescription<any>>(
    desc: Desc
  ): Promise<ResultOfCellDesc<Desc>> {
    const cell = await waitForCell(this.backend, this.runtime.logger, desc);
    if (!cell) {
      throw new Error(`Cell ${desc.getCacheKey()} does not exist`);
    }
    return cell.get(this, this.runtime);
  }

  // Internal direct access
  _read<Desc extends IncrementalCellDescription<any>>(
    cell: IncrementalCellRuntime<Desc>
  ): Promise<ResultOfCellDesc<Desc>> {
    return cell.get(this, this.runtime);
  }

  call<Input, Output, Cell extends CellsTypes>(
    schema: IncrementalFunctionSchema<Input, Output, Cell>,
    input: Input
  ) {
    const desc = new IncrementalFunctionCallDescription(schema, input);
    const func = this.backend.getComputation(desc, false);
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
  Cells extends CellsTypes,
> extends IncrementalComputationRuntime<
  IncrementalContextRuntime<Input, Output, Cells>,
  Output
> {
  readonly logger: Logger;
  // Cells read and the oldest version which was read in this run
  readonly readCells: Map<IncrementalCellRuntime<any>, Version | null>;
  // Owned resolved cells
  readonly ownedCells: Map<
    string,
    {
      array: IncrementalCellRuntime<IncrementalAllocatedCellDescription<any>>[];
      activeLen: number;
    }
  >;
  // Output cell
  readonly outputCell: IncrementalCellRuntime<
    IncrementalOutputCellDescription<Output>
  >;
  // Cacheable mixin
  readonly cacheableMixin: CacheableComputationMixin<this> | null;

  constructor(
    backend: IncrementalBackend,
    readonly desc: IncrementalFunctionCallDescription<Input, Output, Cells>
  ) {
    super(backend, desc);
    this.logger = this.backend.logger.createChildLogger(
      `function > ${this.desc[$FORMAT]()}`
    );
    this.cacheableMixin = this.isCacheable
      ? new CacheableComputationMixin(this)
      : null;
    this.readCells = new Map();
    this.ownedCells = new Map();
    this.outputCell = new IncrementalCellRuntime(
      backend,
      this,
      new IncrementalOutputCellDescription(desc)
    );
  }

  override getCell<Desc extends IncrementalCellDescription<any>>(
    desc: Desc
  ): IncrementalCellRuntime<Desc> | undefined {
    if (desc instanceof IncrementalOutputCellDescription) {
      return this.outputCell as any;
    }
    if (desc instanceof IncrementalAllocatedCellDescription) {
      return this.ownedCells.get(desc.key)?.array[desc.index] as any;
    }
  }

  override setOutputValue(value: Output) {
    this.outputCell.set(value);
  }

  allocSlot(key: string) {
    return computeIfAbsent(this.ownedCells, key, () => ({
      array: [],
      activeLen: 0,
    }));
  }

  alloc<K extends string & keyof Cells>(
    ctx: IncrementalContextRuntime<Input, Output, Cells>,
    key: K
  ) {
    ctx.checkActive();
    const slot = this.allocSlot(key);
    let cell: IncrementalCellRuntime<
      IncrementalAllocatedCellDescription<Cells[K]>
    >;
    if (slot.activeLen < slot.array.length) {
      // Reusing the cell created in the last run
      cell = slot.array[slot.activeLen - 1];
    } else {
      // We need to create a new cell instance
      cell = new IncrementalCellRuntime(
        this.backend,
        this,
        new IncrementalAllocatedCellDescription(this.desc, key, slot.activeLen)
      );
      slot.array.push(cell);
    }
    slot.activeLen++;
    return cell;
  }

  protected createContext(): IncrementalContextRuntime<Input, Output, Cells> {
    return new IncrementalContextRuntime(this.backend, this);
  }

  protected exec(ctx: IncrementalContextRuntime<Input, Output, Cells>) {
    this.logger.debug("Executing...");
    return this.desc.schema.impl(ctx, this.desc.input);
  }

  protected async reloadRoutine(
    ctx: IncrementalContextRuntime<Input, Output, Cells>
  ) {
    this.logger.debug("Reloading...");
    const ok = await this.cacheableMixin!.reloadRoutine(ctx);
    if (!ok) {
      this.logger.debug("We need to re-execute...");
    }
    return ok;
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

  invalidateRoutine() {
    // Set output cell to pending
    this.outputCell.setPending();
    // Reset cells (but keep the instances for reuse)
    for (const slot of this.ownedCells.values()) {
      slot.activeLen = 0;
    }
    // Clear the dependencies
    for (const cell of this.readCells.keys()) {
      cell.removeReader(this);
    }
    this.readCells.clear();
  }

  protected deleteRoutine() {
    this.cacheableMixin?.deleteRoutine();
  }

  protected onStateChange(from: StateNotDeleted, to: StateNotCreating) {}
}
