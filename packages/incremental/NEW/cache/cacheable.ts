import { never } from "../../../util/miscellaneous";
import { sameVersion, type Version } from "../../utils/versions";
import { serializationDB } from "../../utils/serialization-db";
import { type CacheDB } from "../cache/cache-db";
import type {
  IncrementalContextRuntime,
  IncrementalFunctionRuntime,
} from "../runtime/functions";
import type { VersionedValue } from "../descriptions/values";
import type {
  AnyIncrementalCellDescription,
  IncrementalCellDescription,
} from "../descriptions/cells";
import type {
  AnyIncrementalFunctionCallDescription,
  IncrementalFunctionImpl,
} from "../descriptions/functions";
import type { ResultTypeOfComputation } from "../runtime/computations";

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
  private firstExec: boolean;

  constructor(public readonly source: C) {
    this.db = source.backend.db;
    this.desc = source.desc;
    this.isCacheable = this.db != null && this.desc.schema.cacheable;
    this.firstExec = true;
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
          ownedCells.push(array[i].desc);
        }
      }

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
      this.firstExec = false;
      this.db!.deleteFunc(this.desc);
      // When invalidating, we probably will re-execute soon
      // Do not force a flush now
    }
  }

  deleteRoutine() {
    if (this.isCacheable) {
      this.firstExec = false;
      this.db!.deleteFunc(this.desc);
      this.db!.flushFunc(this.desc);
    }
  }

  async preExec(): Promise<void> {
    if (this.isCacheable && this.firstExec) {
      this.cachedEntry = this.entryInDisk = this.db!.getEntry(this.desc);
    }
  }

  // If a computation only relies on "ctx" calls, then we can use this
  // Otherwise, use "preExec" instead, and rely on the "finishRoutine"
  // to give subscribers the correct version by using "responseEqual"
  async exec(
    baseExec: IncrementalFunctionImpl<any, any, any>,
    ctx: IncrementalContextRuntime<any, any, any>,
    input: any
  ): Promise<ResultTypeOfComputation<C>> {
    if (this.isCacheable && this.firstExec) {
      const currentEntry = (this.inDisk = this.db!.getEntry(this.desc));
      // If currentEntry.useDeps is false, it means the cache does not have the version of the dependencies we need
      // or that the computation depends on more than just the "ctx" calls
      // So, just execute the computation again and rely on "finishRoutine"
      if (currentEntry && currentEntry.useDeps) {
        const cached = currentEntry.value;
        try {
          const jobs = [];
          for (const dep of currentEntry.deps) {
            switch (dep.kind) {
              case "get": {
                if (this.source.dependentMixin) {
                  jobs.push(
                    this.source.dependentMixin
                      .getDep(dep.desc, runId)
                      .then(({ result, version }) => {
                        if (!result.ok || !sameVersion(version, dep.version)) {
                          throw new Error("Outdated");
                        }
                      })
                  );
                } else {
                  throw new Error("Outdated");
                }
                break;
              }
              case "compute":
                if (this.source.parentMixin) {
                  this.source.parentMixin.compute(
                    this.source.registry.make(dep.desc),
                    runId
                  );
                } else {
                  throw new Error("Outdated");
                }
                break;
              default:
                never(dep);
            }
          }
          await Promise.all(jobs);
          return cached;
        } catch (err) {
          // Check we are still running
          ctx.checkActive();
          // Invalidate
          this.source.dependentMixin?.invalidateRoutine();
          this.source.parentMixin?.invalidateRoutine();
          this.invalidateRoutine();
        }
      }
    }
    // Execute from scratch
    return baseExec(ctx, input);
  }
}
