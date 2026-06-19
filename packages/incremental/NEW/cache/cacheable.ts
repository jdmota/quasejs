import { type Version } from "../../utils/versions";
import { type CacheDB } from "../cache/cache-db";
import {
  waitForCell,
  type IncrementalContextRuntime,
  type IncrementalFunctionRuntime,
} from "../runtime/functions";
import type {
  AnyIncrementalCellDescription,
  IncrementalCellDescription,
} from "../descriptions/cells";
import type { AnyIncrementalFunctionCallDescription } from "../descriptions/functions";
import { IncrementalCellRuntime } from "../runtime/cells";

export type CachedCell<C> = Readonly<{
  type: "cell";
  desc: IncrementalCellDescription<C>;
  value: C;
  version: Version;
}>;

export type VersionedCellDesc = readonly [
  AnyIncrementalCellDescription,
  Version,
];

export type CachedFunction = Readonly<{
  type: "function";
  desc: AnyIncrementalFunctionCallDescription;
  readCells: readonly VersionedCellDesc[];
  ownedCells: readonly AnyIncrementalCellDescription[];
  outputCell: AnyIncrementalCellDescription;
}>;

export class CacheableComputationMixin<
  C extends IncrementalFunctionRuntime<any, any, any>,
> {
  public readonly db: CacheDB | null;
  public readonly desc: AnyIncrementalFunctionCallDescription;

  constructor(public readonly source: C) {
    this.db = source.backend.db;
    this.desc = source.desc;
  }

  private async reloadAttempt(
    ctx: IncrementalContextRuntime<any, any, any>,
    cachedFunc: CachedFunction
  ): Promise<boolean> {
    for (const desc of cachedFunc.ownedCells) {
      const { key } = desc;
      const cachedCell = this.db!.getCell(desc);
      if (!cachedCell) {
        this.source.logger.warn(
          `Function was in cache, but its cell ${desc.format()} was not`
        );
        return false;
      }

      const valDef = this.desc.schema.cellsDef[key];
      if (!valDef) {
        this.source.logger.warn(
          `Function was in cache, but could not reload cell with key ${key} due to lack of type definition`
        );
        return false;
      }

      const slot = this.source.allocSlot(key);
      const cell = new IncrementalCellRuntime(
        this.source.backend,
        this.source,
        valDef,
        key,
        slot.activeLen,
        desc.resolved,
        cachedCell
      );
      slot.array.push(cell);
      slot.activeLen++;
    }

    for (const [desc, version] of cachedFunc.readCells) {
      const owner = this.source.backend.getCellOwner(desc.owner);
      if (!owner) {
        this.source.logger.warn(
          `Could not create or find cell owner ${desc.owner.format()}`
        );
        return false;
      }
      const cell = await waitForCell(
        this.source.backend,
        this.source.logger,
        desc
      );
      if (!cell) {
        return false;
      }
      // Get cell result
      await cell.get(ctx, this.source);
      if (!cell.isLatest(version)) {
        // Version missmatch, we need to rerun this function
        return false;
      }
      cell.dependents.set(this.source, version);
      this.source.logger.debug(
        `${this.source.desc.format()} -> ${desc.format()}`
      );
    }

    // Reload output cell
    const cachedCell = this.db!.getCell(cachedFunc.outputCell);
    if (!cachedCell) {
      this.source.logger.warn(
        `Function was in cache, but its output cell was not`
      );
      return false;
    }
    this.source.outputCell._set(cachedCell.value, cachedCell.version);

    return true;
  }

  async reloadRoutine(
    ctx: IncrementalContextRuntime<any, any, any>
  ): Promise<boolean> {
    const cachedFunc = this.db!.getFunc(this.desc);
    if (!cachedFunc) {
      return false;
    }

    const ok = await this.reloadAttempt(ctx, cachedFunc);
    if (!ok) {
      // Backtrack
      const { ownedCells, outputCell, readCells } = this.source;
      ownedCells.clear();
      outputCell.setPending();
      for (const cell of readCells.keys()) {
        cell.dependents.delete(this.source);
      }
      readCells.clear();
    }
    return ok;
  }

  // TODO account for root cells

  finishRoutine() {
    const outputCell = this.source.outputCell;
    const readCells: VersionedCellDesc[] = [];
    const ownedCells: AnyIncrementalCellDescription[] = [];

    // Save read cells
    for (const [cell, version] of this.source.readCells) {
      if (version == null || !cell.isLatest(version)) {
        // With a pending read, no point in caching
        // If by any chance the cell was updated, also bail
        this.db!.deleteFunc(this.desc);
        return;
      }
      readCells.push([cell.desc, version]);
    }

    // Save owned cells
    for (const { array, activeLen } of this.source.ownedCells.values()) {
      for (let i = 0; i < activeLen; i++) {
        ownedCells.push(array[i].desc);
        this.db!.saveCell(array[i]);
      }
    }

    // Save output cell
    this.db!.saveCell(outputCell);

    // Save function
    const entry: CachedFunction = {
      type: "function",
      desc: this.desc,
      readCells,
      ownedCells,
      outputCell: outputCell.desc,
    };
    this.db!.setFunc(this.desc, entry);
    this.db!.flushFunc(this.desc);
  }

  deleteRoutine() {
    this.db!.deleteFunc(this.desc);
    this.db!.flushFunc(this.desc);
    // TODO should also delete its cells
  }
}
