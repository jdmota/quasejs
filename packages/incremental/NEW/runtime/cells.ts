import { type Defer, createDefer } from "../../../util/deferred";
import type { Version } from "../../utils/versions";
import type { IncrementalBackend } from "./backend";
import {
  type IncrementalCellOwnerDescription,
  IncrementalCellDescription,
} from "../descriptions/cells";
import type {
  VersionedValue,
  ValueDescription,
  ChangedValue,
} from "../descriptions/values";
import type {
  IncrementalFunctionRuntime,
  IncrementalContextRuntime,
} from "./functions";

// TODO support root level cells

// Cell descriptions are similar to pointers
// Trying to read a deleted cell is like dereferencing a dangling pointer

export interface IncrementalCellOwner {
  readonly rawDesc: IncrementalCellOwnerDescription;
  inv(): void;
  getCell<Value>(
    desc: IncrementalCellDescription<Value>
  ): IncrementalCellRuntime<Value> | undefined;
  onReadCell<Value>(cell: IncrementalCellRuntime<Value>): void;
}

export class IncrementalCellRuntime<Value> {
  readonly desc: IncrementalCellDescription<Value>;
  private result: VersionedValue<Value> | null = null;
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
    private readonly backend: IncrementalBackend,
    private readonly owner: IncrementalCellOwner,
    private readonly valueDef: ValueDescription<Value, any>,
    private readonly key: string,
    private readonly index: number,
    private readonly resolved: boolean
  ) {
    this.desc = new IncrementalCellDescription(
      owner.rawDesc,
      key,
      index,
      resolved
    );
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

  set(value: Value): ChangedValue<Value> {
    this.inv();
    const { result } = this;
    this.pending = false;
    if (this.result == null || !this.valueDef.equal(this.result[0], value)) {
      this.result = [value, this.backend.getNextVersion()];
      for (const [consumer, versionRead] of this.dependents) {
        if (versionRead) {
          consumer.invalidate();
        }
      }
    }
    this.defer?.resolve();
    this.defer = null;
    return { old: result, new: this.result };
  }

  async get(
    ctx: IncrementalContextRuntime<any, any, any>,
    consumer: IncrementalFunctionRuntime<any, any, any>
  ): Promise<Value> {
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
    }

    this.owner.onReadCell(this);

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

  async entryGet(): Promise<Value> {
    this.inv();
    this.owner.onReadCell(this);
    while (!this.result || this.pending) {
      await (this.defer ?? (this.defer = createDefer())).promise;
    }
    const result = this.result;
    return result[0];
  }
}
