import { never } from "../../../util/miscellaneous";
import { sameVersion } from "../../utils/versions";
import { serializationDB } from "../../utils/serialization-db";
import {
  type CacheDB,
  type CachedDep,
  type CacheEntry,
  sameCacheEntry,
} from "../cache/cache-db";
import type {
  IncrementalContextRuntime,
  IncrementalFunctionRuntime,
} from "../runtime/functions";
import type { VersionedValue } from "../descriptions/values";
import type {
  AnyIncrementalFunctionCallDescription,
  IncrementalFunctionImpl,
} from "../descriptions/functions";
import type { ResultTypeOfComputation } from "../runtime/computations";

export class CacheableComputationMixin<
  C extends IncrementalFunctionRuntime<any, any, any>,
> {
  public readonly db: CacheDB | null;
  public readonly desc: AnyIncrementalFunctionCallDescription;
  public readonly isCacheable: boolean;
  private firstExec: boolean;
  private inDisk: CacheEntry<C> | undefined;

  constructor(public readonly source: C) {
    this.db = source.backend.db;
    this.desc = source.desc;
    this.isCacheable = this.db != null && this.desc.schema.cacheable;
    this.firstExec = true;
    this.inDisk = undefined;
  }

  finishRoutine(
    original: VersionedValue<ResultTypeOfComputation<C>>,
    useDeps: boolean // Should be true if CacheableComputationMixin#exec is going to be used!
  ): VersionedValue<ResultTypeOfComputation<C>> {
    const [originalValue, originalVersion] = original;
    if (this.isCacheable) {
      const { firstExec } = this;
      this.firstExec = false;

      const calls: CachedDep[] = [];

      if (useDeps && this.source.dependentMixin) {
        const getCalls = this.source.dependentMixin.getAllGetCalls();
        if (!getCalls) {
          this.db!.removeEntry(this.desc);
          this.db!.logger.debug("DELETED", { desc: this.desc });
          return original;
        }
        for (const dep of getCalls) {
          if (serializationDB.canSerialize(dep.computation.description)) {
            calls.push({
              kind: "get",
              desc: dep.computation.description,
              version: dep.version,
            });
          } else {
            useDeps = false;
            calls.length = 0;
            break;
          }
        }
      }

      if (useDeps && this.source.parentMixin) {
        for (const child of this.source.parentMixin.getChildren()) {
          if (serializationDB.canSerialize(child.description)) {
            calls.push({
              kind: "compute",
              desc: child.description,
            });
          } else {
            useDeps = false;
            calls.length = 0;
            break;
          }
        }
      }

      let currentEntry = this.inDisk;
      if (firstExec && currentEntry) {
        const cached = currentEntry.value;
        if (this.desc.schema.outputDef.equal(cached, originalValue)) {
          // If the final value is the same, keep the cached version number
          const entry: CacheEntry<C> = {
            desc: this.desc,
            value: cached,
            deps: calls,
            useDeps,
            version: currentEntry.version,
          };
          if (sameCacheEntry(entry, currentEntry)) {
            this.db!.logger.debug("REUSING (ALREADY SAVED)", {
              desc: this.desc,
              entry,
            });
          } else {
            this.db!.saveEntry(this.desc, entry);
            this.db!.logger.debug("REUSING (RE-SAVING)", {
              desc: this.desc,
              entry,
            });
          }
          return [cached, currentEntry.version];
        }
      }

      const entry: CacheEntry<C> = {
        desc: this.desc,
        value: originalValue,
        deps: calls,
        useDeps,
        version: originalVersion,
      };
      this.db!.saveEntry(this.desc, entry);
      this.db!.logger.debug("NOT REUSING", {
        desc: this.desc,
        entry,
        currentEntry,
      });
    }
    return original;
  }

  invalidateRoutine() {
    if (this.isCacheable) {
      this.firstExec = false;
      this.inDisk = undefined;
      // When invalidating, we probably will re-execute soon
      // Do not delete entry from the in disk cache
    }
  }

  deleteRoutine() {
    if (this.isCacheable) {
      this.firstExec = false;
      this.inDisk = undefined;
      this.db!.removeEntry(this.desc);
    }
  }

  async preExec(): Promise<void> {
    if (this.isCacheable && this.firstExec) {
      this.inDisk = this.db!.getEntry(this.desc);
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
