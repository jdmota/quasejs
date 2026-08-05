import { $FORMAT } from "../../../util/values";
import {
  type CacheDB,
  type CachedFunction,
  type VersionedCellDesc,
} from "../cache/cache-db";
import {
  type IncrementalContextRuntime,
  type IncrementalFunctionRuntime,
  waitForCell,
} from "../runtime/functions";
import { IncrementalAllocatedCellDescription } from "../descriptions/cells";
import type { AnyIncrementalFunctionCallDescription } from "../descriptions/functions";
import { IncrementalCellRuntime } from "../runtime/cells";

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
        this.source.logger.debug(
          `Function was in cache, but its cell ${desc[$FORMAT]()} was not`
        );
        return false;
      }

      const slot = this.source.allocSlot(key);
      const cell = new IncrementalCellRuntime(
        this.source.backend,
        this.source,
        desc,
        cachedCell
      );
      slot.array.push(cell);
      slot.activeLen++;
    }

    for (const [desc, version] of cachedFunc.readCells) {
      const cell = await waitForCell(
        this.source.backend,
        this.source.logger,
        desc
      );
      ctx.checkActive();
      if (!cell) {
        return false;
      }
      // Get cell result
      await cell.get(ctx, this.source);
      ctx.checkActive();
      if (!cell.isLatest(version)) {
        // Version missmatch, we need to rerun this function
        return false;
      }
      cell.dependents.set(this.source, version);
      this.source.logger.debug(
        `${this.source.desc[$FORMAT]()} -> ${desc[$FORMAT]()}`
      );
    }

    // Reload output cell
    const cachedCell = this.db!.getCell(cachedFunc.outputCell);
    if (!cachedCell) {
      this.source.logger.debug(
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

    // TODO catch serialization errors
    const ok = await this.reloadAttempt(ctx, cachedFunc);
    ctx.checkActive();
    if (!ok) {
      // Backtrack
      this.source.invalidateRoutine();
    }
    return ok;
  }

  // TODO account for root cells

  finishRoutine() {
    const outputCell = this.source.outputCell;
    const readCells: VersionedCellDesc[] = [];
    const ownedCells: IncrementalAllocatedCellDescription<any>[] = [];

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
        array[i]._cacheCell(this.db!);
      }
    }

    // Save output cell
    outputCell._cacheCell(this.db!);

    // Save function
    const entry: CachedFunction = {
      type: "function",
      desc: this.desc,
      readCells,
      ownedCells,
      outputCell: outputCell.desc,
    };
    this.db!.setFunc(this.desc, entry);
  }

  deleteRoutine() {
    this.db!.deleteFunc(this.desc);
  }
}
