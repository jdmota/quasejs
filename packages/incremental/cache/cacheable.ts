import { $FORMAT } from "../../util/values";
import { nonNull } from "../../util/miscellaneous";
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
  public readonly db: CacheDB;
  public readonly desc: AnyIncrementalFunctionCallDescription;

  constructor(public readonly source: C) {
    this.db = nonNull(source.backend.db);
    this.desc = source.desc;
  }

  private async reloadAttempt(
    ctx: IncrementalContextRuntime<any, any, any>,
    cachedFunc: CachedFunction
  ): Promise<boolean> {
    for (const desc of cachedFunc.ownedCells) {
      const { key } = desc;
      const cachedCell = this.db.getCell(desc);
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
        this.source.isCacheable,
        cachedCell
      );
      slot.array.push(cell);
      slot.activeLen++;
    }

    for (const call of cachedFunc.calls) {
      ctx.call(call.schema, call.input);
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
        this.source.logger.debug(
          `Dependency ${desc[$FORMAT]()} in cache has outdated version`
        );
        return false;
      }
      cell.dependents.set(this.source, version);
      this.source.logger.debug(`Read dependency ${desc[$FORMAT]()} from cache`);
    }

    // Reload output cell
    const cachedCell = this.db.getCell(cachedFunc.outputCell);
    if (!cachedCell) {
      this.source.logger.debug(
        `Function was in cache, but its output cell was not`
      );
      return false;
    }
    this.source.outputCell._set(cachedCell.value, cachedCell.version, true);

    return true;
  }

  async reloadRoutine(
    ctx: IncrementalContextRuntime<any, any, any>
  ): Promise<boolean> {
    const cachedFunc = this.db.getFunc(this.desc);
    if (!cachedFunc) {
      this.source.logger.debug("Did not find function in cache");
      return false;
    }

    const ok = await this.reloadAttempt(ctx, cachedFunc);
    ctx.checkActive();
    if (ok) {
      this.source.logger.debug("Successful reloading");
    } else {
      // Backtrack
      this.source.logger.debug("Could not reload, backtracking");
      this.source.invalidateRoutine();
    }
    return ok;
  }

  finishRoutine() {
    const outputCell = this.source.outputCell;
    const calls: AnyIncrementalFunctionCallDescription[] = [];
    const readCells: VersionedCellDesc[] = [];
    const ownedCells: IncrementalAllocatedCellDescription<any>[] = [];

    // Save calls
    for (const call of this.source.calls) {
      calls.push(call.desc);
    }

    // Save read cells
    for (const [cell, version] of this.source.readCells) {
      if (version == null || !cell.isLatest(version)) {
        // With a pending read, no point in caching
        // If by any chance the cell was updated, also bail
        return;
      }
      readCells.push([cell.desc, version]);
    }

    // Save owned cells
    for (const { array, activeLen } of this.source.ownedCells.values()) {
      for (let i = 0; i < activeLen; i++) {
        ownedCells.push(array[i].desc);
      }
    }

    // Save function
    const entry: CachedFunction = {
      type: "function",
      desc: this.desc,
      calls,
      readCells,
      ownedCells,
      outputCell: outputCell.desc,
    };
    this.db.setFunc(this.desc, entry);
  }

  deleteRoutine() {
    this.db.deleteFunc(this.desc);
  }
}
