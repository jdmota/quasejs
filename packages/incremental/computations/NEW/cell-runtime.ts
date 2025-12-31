import { type Defer, createDefer } from "../../../util/deferred";
import type { Version } from "../../utils/versions";
import type { IncrementalBackend } from "./backend";
import { IncrementalCellDescription } from "./cells";
import type {
  IncrementalFunctionRuntime,
  IncrementalContextRuntime,
} from "./function-runtime";
import type { VersionedValue, ValueDescription, ChangedValue } from "./values";

export class IncrementalCellRuntime<Value> {
  readonly desc: IncrementalCellDescription<Value>;
  private result: VersionedValue<Value> | null = null;
  private defer: Defer<void> | null = null;
  // This flag is used to delay resolution
  // when we know a new value might be incoming
  private pending = true;
  // Dependents of this cell and the oldest version which they read
  public dependents: Map<
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

  set(value: Value): ChangedValue<Value> {
    this.owner.inv();
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
    this.owner.inv();
    if (consumer === this.owner) {
      throw new Error("Cannot read own cell");
    }

    ctx.checkActive();
    if (!this.dependents.has(consumer)) {
      this.dependents.set(consumer, null);
      consumer.readCells.set(this, null);
    }

    if (this.owner.outputCell === this) {
      // Ensure progress
      this.owner.maybeRun();
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
      consumer.invalidate();
    }

    return result[0];
  }

  async entryGet(): Promise<Value> {
    this.owner.inv();
    if (this.owner.outputCell === this) {
      // Ensure progress
      this.owner.maybeRun();
    }
    while (!this.result || this.pending) {
      await (this.defer ?? (this.defer = createDefer())).promise;
    }
    const result = this.result;
    return result[0];
  }
}
