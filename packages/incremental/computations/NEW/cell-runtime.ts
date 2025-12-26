import { type Defer, createDefer } from "../../../util/deferred";
import type { Version } from "../../utils/versions";
import type { IncrementalBackend } from "./backend";
import { IncrementalCellDescription } from "./cells";
import type {
  IncrementalFunctionRuntime,
  IncrementalContextRuntime,
} from "./function-runtime";
import type { VersionedValue, ValueDescription } from "./values";

export class IncrementalCellRuntime<Value> {
  readonly desc: IncrementalCellDescription<Value>;
  private result: VersionedValue<Value> | null = null;
  private defer: Defer<void> | null = null;
  private pending = true;
  // Dependents of this cell and the oldest version which they read
  private dependents: Map<
    IncrementalFunctionRuntime<any, any, any>,
    Version | null
  > = new Map();

  constructor(
    private readonly backend: IncrementalBackend,
    private readonly owner: IncrementalFunctionRuntime<any, any, any>,
    private readonly valueDef: ValueDescription<Value, any>,
    private readonly key: string,
    private readonly index: number,
    private readonly resolved: boolean
  ) {
    this.desc = new IncrementalCellDescription(
      owner.desc,
      key,
      index,
      resolved
    );
  }

  setPending() {
    this.pending = true;
  }

  set(value: Value) {
    this.pending = false;
    if (this.result == null || !this.valueDef.equal(this.result[0], value)) {
      this.result = [value, this.backend.getNextVersion()];
      for (const [consumer, versionRead] of this.dependents) {
        if (versionRead) {
          consumer.setDirty();
        }
      }
    }
    this.defer?.resolve();
    this.defer = null;
  }

  async get(
    ctx: IncrementalContextRuntime<any, any, any>,
    consumer: IncrementalFunctionRuntime<any, any, any>
  ): Promise<Value> {
    if (consumer === this.owner) {
      throw new Error("Cannot read own cell");
    }
    ctx.checkActive();
    if (!this.dependents.has(consumer)) {
      this.dependents.set(consumer, null);
      consumer.readCells.set(this, null);
    }

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
      consumer.setDirty();
    }

    return result[0];
  }
}
