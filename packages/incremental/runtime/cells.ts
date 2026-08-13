import { valueEquals } from "../../util/values";
import { type Defer, createDefer } from "../../util/deferred";
import {
  type ChangedValue,
  type Version,
  type VersionedValue,
  sameVersion,
} from "../utils/versions";
import { type IncrementalBackend } from "./backend";
import type { CachedCell } from "../cache/cache-db";
import {
  type ResultOfCellDesc,
  IncrementalCellDescription,
} from "../descriptions/cells";
import type {
  IncrementalFunctionRuntime,
  IncrementalContextRuntime,
} from "./functions";
import type { IncrementalCellOwner } from "./cell-owners";

export class IncrementalCellRuntime<
  Desc extends IncrementalCellDescription<any>,
> {
  public readonly isCacheable: boolean;
  // Versioned result
  private result: VersionedValue<ResultOfCellDesc<Desc>> | null = null;
  // Deferred
  private defer: Defer<void> | null = null;
  // This flag is used to delay resolution
  // when we know a new value might be incoming
  private pending = true;
  // This flag indicates if this cell was deallocated
  // (the flag may be false, but the owner be deleted, see "inv()")
  private deleted = false;
  // Dependents of this cell and the oldest version which they read
  public dependents: Map<
    IncrementalFunctionRuntime<any, any, any>,
    Version | null
  > = new Map();

  constructor(
    private readonly backend: IncrementalBackend<any>,
    private readonly owner: IncrementalCellOwner,
    public readonly desc: Desc,
    isCacheable: boolean,
    fromCache: CachedCell<ResultOfCellDesc<Desc>> | null = null
  ) {
    this.isCacheable = backend.db != null && isCacheable;
    if (fromCache) {
      this.pending = false;
      this.result = [fromCache.value, fromCache.version];
    }
  }

  inv() {
    if (this.deleted) {
      throw new Error("This cell was deleted");
    }
    // Check if the owner was deleted
    this.owner.inv();
  }

  setDeleted() {
    this.deleted = true;
  }

  setPending() {
    this.pending = true;
  }

  isLatest(version: Version) {
    return this.result != null && sameVersion(this.result[1], version);
  }

  removeReader(reader: IncrementalFunctionRuntime<any, any, any>) {
    if (this.dependents.delete(reader)) {
      this.owner.onUnsubscribed(this);
    }
  }

  set(value: ResultOfCellDesc<Desc>): ChangedValue<ResultOfCellDesc<Desc>> {
    return this._set(value, null, false);
  }

  // Used internally
  _set(
    value: ResultOfCellDesc<Desc>,
    version: Version | null,
    reloading: boolean
  ): ChangedValue<ResultOfCellDesc<Desc>> {
    this.inv();
    const { result } = this;
    this.pending = false;
    if (this.result == null || !valueEquals(this.result[0], value)) {
      this.result = [value, version ?? this.backend.getNextVersion()];
      for (const [consumer, versionRead] of this.dependents) {
        if (versionRead) {
          consumer.invalidate();
        }
      }
      if (!reloading) {
        this._cacheCell();
      }
    }
    this.defer?.resolve();
    this.defer = null;
    return { old: result, new: this.result };
  }

  // Returns "true" if the cached value was accepted
  _reload(
    cached: CachedCell<ResultOfCellDesc<Desc>> | null | undefined,
    newValue: ResultOfCellDesc<Desc>
  ): boolean {
    if (cached != null && valueEquals(cached.value, newValue)) {
      this._set(cached.value, cached.version, true);
      return true;
    }
    this.set(newValue);
    return false;
  }

  async get(
    ctx: IncrementalContextRuntime<any, any, any>,
    consumer: IncrementalFunctionRuntime<any, any, any>
  ): Promise<ResultOfCellDesc<Desc>> {
    // Check first if this run is active
    // If the owner of the cell was deleted,
    // then this consumer should not be active
    ctx.checkActive();
    // Check that cell and owner still exist
    this.inv();

    if (consumer === this.owner) {
      throw new Error("Cannot read own cell");
    }

    if (!this.dependents.has(consumer)) {
      this.dependents.set(consumer, null);
      consumer.readCells.set(this, null);
      this.owner.onSubscribed(this);
    }

    this.owner.demand();

    while (!this.result || this.pending) {
      await (this.defer ?? (this.defer = createDefer())).promise;
      ctx.checkActive();
    }

    const result = this.result;
    const versionRead = this.dependents.get(consumer);
    if (versionRead == null) {
      this.dependents.set(consumer, result[1]);
      consumer.readCells.set(this, result[1]);
    } else if (versionRead !== result[1]) {
      consumer.invalidate();
    }

    return result[0];
  }

  async entryGet(): Promise<ResultOfCellDesc<Desc>> {
    this.inv();
    this.owner.demand();
    while (!this.result || this.pending) {
      await (this.defer ?? (this.defer = createDefer())).promise;
    }
    const result = this.result;
    return result[0];
  }

  _cacheCell() {
    if (this.isCacheable) {
      const { desc, result } = this;
      if (result == null) {
        throw new Error(
          `Invariant violation: trying to save a cell with no result`
        );
      }
      this.backend.db!.setCell(desc, {
        type: "cell",
        desc,
        value: result[0],
        version: result[1],
      });
    }
  }

  _uncacheCell() {
    const db = this.backend.db;
    if (db) {
      db.deleteCell(this.desc);
    }
  }
}
