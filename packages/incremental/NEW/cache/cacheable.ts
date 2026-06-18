import { type Version } from "../../utils/versions";
import { type CacheDB } from "../cache/cache-db";
import type { IncrementalFunctionRuntime } from "../runtime/functions";
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
}>;

export class CacheableComputationMixin<
  C extends IncrementalFunctionRuntime<any, any, any>,
> {
  public readonly db: CacheDB | null;
  public readonly desc: AnyIncrementalFunctionCallDescription;
  public readonly isCacheable: boolean;
  private loadFromCache: boolean;

  constructor(public readonly source: C) {
    this.db = source.backend.db;
    this.desc = source.desc;
    this.isCacheable = this.db != null && this.desc.schema.cacheable;
    this.loadFromCache = this.isCacheable;
  }

  reloadRoutine(): boolean {
    if (!this.loadFromCache) {
      return false;
    }
    this.loadFromCache = false;

    const cachedFunc = this.db!.getFunc(this.desc);
    if (!cachedFunc) {
      return false;
    }

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

    // TODO is the reloading for files working?

    for (const [desc, version] of cachedFunc.readCells) {
      const owner = this.source.backend.makeCellOwner(desc.owner);
      if (!owner) {
        this.source.logger.warn(
          `Could not create or find cell owner ${desc.owner.format()}`
        );
        return false;
      }
      owner.reload();
      const cell = owner.getCell(desc);
      if (!cell) {
        this.source.logger.warn(`Could not find cell ${desc.format()}`);
        return false;
      }
      if (!cell.isLatest(version)) {
        // Version missmatch, we need to rerun this function
        return false;
      }
      cell.dependents.set(this.source, version);
      this.source.logger.trace(
        `${this.source.desc.format()} -> ${desc.format()}`
      );
    }

    return true;
  }

  finishRoutine() {
    if (this.isCacheable) {
      const readCells: VersionedCellDesc[] = [];
      const ownedCells: AnyIncrementalCellDescription[] = [];

      for (const [cell, version] of this.source.readCells) {
        if (version == null || !cell.isLatest(version)) {
          // With a pending read, no point in caching
          // If by any chance the cell was updated, also bail
          this.db!.deleteFunc(this.desc);
          return;
        }
        readCells.push([cell.desc, version]);
      }

      for (const { array, activeLen } of this.source.ownedCells.values()) {
        for (let i = 0; i < activeLen; i++) {
          const { desc, result } = array[i];
          if (result == null) {
            throw new Error(`Invariant violation: owned cell has no result`);
          }
          ownedCells.push(desc);
          this.db!.setCell(desc, {
            type: "cell",
            desc,
            value: result[0],
            version: result[1],
          });
          this.db!.flushCell(desc);
        }
      }

      // TODO account for root cells

      const entry: CachedFunction = {
        type: "function",
        desc: this.desc,
        readCells,
        ownedCells,
      };

      this.db!.setFunc(this.desc, entry);
      this.db!.flushFunc(this.desc);
    }
  }

  invalidateRoutine() {
    if (this.isCacheable) {
      this.loadFromCache = false;
      this.db!.deleteFunc(this.desc);
      // When invalidating, we probably will re-execute soon
      // Do not force a flush now
    }
  }

  deleteRoutine() {
    if (this.isCacheable) {
      this.loadFromCache = false;
      this.db!.deleteFunc(this.desc);
      this.db!.flushFunc(this.desc);
    }
  }
}
