import * as lmdb from "lmdb";
import fsextra from "fs-extra";
import path from "node:path";
import { inspect } from "node:util";
import { arrayEquals, assertion, never } from "../../../util/miscellaneous";
import type {
  IncrementalOpts,
  ResultTypeOfComputation,
} from "../../incremental-lib";
import { type ValueDefinition, HashMap, objValue } from "../../utils/hash-map";
import {
  ComputationResult,
  ok,
  VersionedComputationResult,
} from "../../utils/result";
import {
  AnyRawComputation,
  RawComputation,
  RawComputationContext,
  RawComputationExec,
} from "../raw";
import type { ComputationDescription } from "../description";
import { DependentContext, MaybeDependentComputation } from "./dependent";
import { MaybeParentComputation, MaybeParentContext } from "./parent";
import { CtxWithFS } from "../file-system/file-system";
import { MissingConstructorSerializerError } from "../../../util/serialization";
import { SubscribableComputation } from "./subscribable";
import { ChildComputation } from "./child";
import { sameVersion, Version } from "../../utils/versions";

function checkArray<T>(val: T[] | number): T[] {
  if (Array.isArray(val)) {
    return val;
  }
  throw new Error("Value is " + val);
}

function checkNumber<T>(val: T[] | number): number {
  if (typeof val === "number") {
    return val;
  }
  throw new Error("Value is " + val);
}

export type CachedGet = {
  readonly kind: "get";
  readonly desc: ComputationDescription<
    RawComputation<any, any> & SubscribableComputation<any>
  >;
  readonly version: Version;
};

export type CachedCompute = {
  readonly kind: "compute";
  readonly desc: ComputationDescription<AnyRawComputation & ChildComputation>;
};

export type CachedDep = CachedGet | CachedCompute;

const defaultValDef: ValueDefinition<ComputationDescription<any>> = objValue;

function sameDep(a: CachedDep, b: CachedDep) {
  switch (a.kind) {
    case "get":
      return (
        b.kind === "get" &&
        sameVersion(a.version, b.version) &&
        a.desc.equal(b.desc)
      );
    case "compute":
      return b.kind === "compute" && a.desc.equal(b.desc);
    default:
      never(a);
  }
}

class CacheEntry<Res> {
  constructor(
    readonly value: Res,
    readonly deps: readonly CachedDep[],
    readonly version: Version,
    readonly useDeps: boolean
  ) {}

  equals(other: CacheEntry<Res>) {
    return (
      this.value === other.value &&
      this.useDeps === other.useDeps &&
      sameVersion(this.version, other.version) &&
      arrayEquals(this.deps, other.deps, sameDep)
    );
  }
}

type CachedDepInDisk =
  | {
      readonly kind: "get";
      readonly desc: ComputationDescription<any>;
      readonly version: Version;
    }
  | {
      readonly kind: "compute";
      readonly desc: ComputationDescription<any>;
    };

type CacheEntryInDisk<C extends AnyRawComputation> = {
  readonly desc: ComputationDescription<C>;
  readonly value: ResultTypeOfComputation<C>;
  readonly deps: readonly CachedDepInDisk[];
  readonly useDeps: boolean;
  readonly version: Version;
};

type DB_Val = Readonly<CacheEntryInDisk<any>>[];

export class CacheDB {
  private static DB_VERSION = 1;
  private static CACHE_DB_SESSION_SYM = Symbol.for(
    "quase_incremental_cache_session"
  );

  private readonly dir: string;
  private readonly logFile: string;

  private readonly alive: HashMap<ComputationDescription<any>, null> =
    new HashMap(defaultValDef);

  private locked = false;
  private lastLog: Promise<void>;
  private saveJobs: Map<string, Promise<void>>;
  private db: lmdb.RootDatabase<number | DB_Val, string | symbol>;

  constructor(private readonly opts: IncrementalOpts) {
    this.dir =
      path.resolve(opts.cache.dir) +
      path.sep +
      `quase_incremental_v${CacheDB.DB_VERSION}`;
    this.logFile = this.dir + path.sep + `log${Date.now()}.txt`;
    this.lastLog = Promise.resolve();
    this.saveJobs = new Map();
    this.db = lmdb.open<
      DB_Val | number,
      string | typeof CacheDB.CACHE_DB_SESSION_SYM
    >({
      path: this.dir,
      sharedStructuresKey: Symbol.for("quase_incremental_cache_structures"),
      encoder: {
        structuredClone: true,
      },
    });
  }

  _log(message: string, value?: unknown) {
    if (this.opts.cache.log) {
      this.lastLog = this.lastLog.then(() => {
        return fsextra.appendFile(
          this.logFile,
          `\n\n${message}${value === undefined ? "" : "\n" + inspect(value)}`
        );
      });
    }
  }

  lock() {
    this.locked = true;
  }

  private corruptedKeys: Set<string> = new Set();
  private safeGet(key: string) {
    try {
      return checkArray(this.db.get(key) ?? []);
    } catch (err) {
      if (!this.saveJobs.has(key)) {
        this.corruptedKeys.add(key);
      }
      this._log(
        "ERROR",
        this.addError(
          new Error(`Corrupted key ${key}`, {
            cause: err,
          })
        )
      );
      return [];
    }
  }

  private getKey(desc: ComputationDescription<any>) {
    // max byte key size = 1978
    // UTF-8 characters can be 1 to 4 bytes long
    return desc.key().slice(0, 1978 / 4); // estimate...
  }

  getEntry<C extends AnyRawComputation>(desc: ComputationDescription<C>) {
    const key = this.getKey(desc);
    const dbValue = this.safeGet(key);
    for (const entry of dbValue) {
      if (entry.desc.equal(desc)) {
        this.alive.set(desc, null);
        return this.unpackEntry<C>(entry as CacheEntryInDisk<C>);
      }
    }
  }

  saveEntry<C extends AnyRawComputation>(
    desc: ComputationDescription<C>,
    entry: CacheEntry<ResultTypeOfComputation<C>>
  ) {
    if (this.locked) {
      return;
    }
    this.alive.set(desc, null);
    this.saveOne(desc, entry);
  }

  removeEntry(desc: ComputationDescription<any>) {
    if (this.locked) {
      return;
    }
    this.alive.delete(desc);
    this.saveOne(desc, null);
  }

  private saveOne(
    desc: ComputationDescription<any>,
    entry: CacheEntry<any> | null
  ) {
    const key = this.getKey(desc);
    this.corruptedKeys.delete(key);
    const prevJob = this.saveJobs.get(key) ?? Promise.resolve();
    this.saveJobs.set(
      key,
      prevJob.then(() => this._saveOne(key, desc, entry))
    );
  }

  private removeEntryOutdatedKey(
    key: string,
    desc: ComputationDescription<any>
  ) {
    this.corruptedKeys.delete(key);
    const prevJob = this.saveJobs.get(key) ?? Promise.resolve();
    this.saveJobs.set(
      key,
      prevJob.then(() => this._saveOne(key, desc, null))
    );
  }

  private async _saveOne(
    key: string,
    desc: ComputationDescription<any>,
    entry: CacheEntry<any> | null
  ) {
    const packedEntry = this.packEntry(desc, entry);
    try {
      await this.db.transaction(async () => {
        const entries = this.safeGet(key);
        const idx = entries.findIndex(e => e.desc.equal(desc));

        if (packedEntry) {
          if (idx >= 0) {
            entries[idx] = packedEntry;
          } else {
            entries.push(packedEntry);
          }
        } else {
          if (idx >= 0) {
            entries.splice(idx, 1);
          }
        }

        if (entries.length > 0) {
          await this.db.put(key, entries);
        } else {
          await this.db.remove(key);
        }
      });

      if (packedEntry) {
        this._log("SAVED ENTRY", packedEntry);
      } else {
        this._log("DELETED ENTRY", desc);
      }
    } catch (err) {
      this._log(
        "ERROR",
        this.addError(
          new Error(
            `Error ${packedEntry ? "saving" : "deleting"} entry with description ${inspect(desc)}`,
            {
              cause: err,
            }
          )
        )
      );
    }
  }

  async newGlobalSession() {
    // A global session number avoids confusion between
    // computation versions created in different sessions
    // We need to renew this session number when:
    // - Loading for the first time from the disk
    // - After deleting computations at runtime (because they might be recreated later)
    return await this.db.transaction(async () => {
      const session = checkNumber(
        this.db.get(CacheDB.CACHE_DB_SESSION_SYM) || 1
      );
      const newSession = session + 1;
      await this.db.put(CacheDB.CACHE_DB_SESSION_SYM, newSession);
      return newSession;
    });
  }

  async save(interrupted: boolean) {
    assertion(this.locked);

    // If this run was interrupted, don't GC to avoid deleting useful entries that didn't get the chance to be flagged as "alive"
    const gc = !interrupted && this.opts.cache.garbageCollect;

    this._log("=== SAVING CACHE ===");

    if (gc) {
      for (const key of this.db.getKeys()) {
        if (typeof key === "symbol") continue;
        const dbValue = this.safeGet(key);
        for (const entry of dbValue) {
          if (!this.alive.has(entry.desc)) {
            this._log("=== GC OLD ENTRY ===", entry.desc);
            this.saveOne(entry.desc, null);
          } else if (key !== this.getKey(entry.desc)) {
            this._log("=== GC ENTRY WITH OUTDATED KEY ===", entry.desc);
            this.removeEntryOutdatedKey(key, entry.desc);
          }
        }
      }
    }

    for (const [key, job] of this.saveJobs) {
      await job;
    }

    for (const key of this.corruptedKeys) {
      await this.db.remove(key);
      this._log("=== REMOVE CORRUPTED KEY ===", key);
    }

    await this.db.close();

    this._log("=== SAVED CACHE ===");

    this.printErrors();

    await this.lastLog;
  }

  private errors: unknown[] = [];
  private missingSerializers: Set<string> = new Set();

  private addError(error: unknown) {
    if (error instanceof MissingConstructorSerializerError) {
      this.missingSerializers.add(error.constructorName);
    }
    if (
      error instanceof Error &&
      error.cause instanceof MissingConstructorSerializerError
    ) {
      this.missingSerializers.add(error.cause.constructorName);
    }
    this.errors.push(error);
    return error;
  }

  private nextErrorIdx = 0;

  private printErrors() {
    for (; this.nextErrorIdx < this.errors.length; this.nextErrorIdx++) {
      this.opts.cache.reporter.error(
        "Error when saving cache:",
        this.errors[this.nextErrorIdx]
      );
    }

    if (this.missingSerializers.size) {
      this.opts.cache.reporter.error(
        "Missing serializers for:",
        ...this.missingSerializers
      );
    }
  }

  private unpackEntry<C extends AnyRawComputation>(entry: CacheEntryInDisk<C>) {
    const { value, deps, version, useDeps } = entry;
    return new CacheEntry(value, deps, version, useDeps);
  }

  private packEntry<C extends AnyRawComputation>(
    desc: ComputationDescription<C>,
    entry: CacheEntry<ResultTypeOfComputation<C>> | null
  ): CacheEntryInDisk<C> | null {
    if (entry == null) {
      return null;
    }
    return {
      desc,
      value: entry.value,
      deps: entry.useDeps ? entry.deps : [],
      useDeps: entry.useDeps,
      version: entry.version,
    };
  }
}

export interface CacheableComputation<
  C extends RawComputation<any, ResultTypeOfComputation<C>>,
> {
  readonly cacheableMixin: CacheableComputationMixin<C>;
}

type CacheableCtx = RawComputationContext &
  CtxWithFS &
  DependentContext &
  MaybeParentContext<any> & {
    readonly request?: any;
  };

export class CacheableComputationMixin<
  C extends RawComputation<any, ResultTypeOfComputation<C>>,
> {
  public readonly db: CacheDB;
  public readonly isCacheable: boolean;
  private firstExec: boolean;
  private inDisk: CacheEntry<ResultTypeOfComputation<C>> | undefined;

  constructor(
    public readonly source: C &
      MaybeDependentComputation &
      MaybeParentComputation,
    public readonly desc: ComputationDescription<C>
  ) {
    this.db = source.registry.db;
    this.isCacheable = true;
    this.firstExec = true;
    this.inDisk = undefined;
  }

  finishRoutine(
    original: VersionedComputationResult<ResultTypeOfComputation<C>>,
    storeDeps: boolean // Should be true if CacheableComputationMixin#exec is going to be used!
  ): VersionedComputationResult<ResultTypeOfComputation<C>> {
    const { result, version } = original;
    if (this.isCacheable) {
      const { firstExec } = this;
      this.firstExec = false;

      if (result.ok) {
        const calls: CachedDep[] = [];

        if (storeDeps && this.source.dependentMixin) {
          const getCalls = this.source.dependentMixin.getAllGetCalls();
          if (!getCalls) {
            this.db.removeEntry(this.desc);
            this.db._log("DELETED", { desc: this.desc });
            return original;
          }
          for (const dep of getCalls) {
            calls.push({
              kind: "get",
              desc: dep.computation.description,
              version: dep.version,
            });
          }
        }

        if (storeDeps && this.source.parentMixin) {
          for (const child of this.source.parentMixin.getChildren()) {
            calls.push({
              kind: "compute",
              desc: child.description,
            });
          }
        }

        let currentEntry = this.inDisk;
        if (firstExec && currentEntry) {
          const cached = currentEntry.value;
          if (
            cached === result.value ||
            this.source.responseEqual(cached, result.value)
          ) {
            // If the final value is the same, keep the cached version number
            const entry = new CacheEntry(
              cached,
              calls,
              currentEntry.version,
              storeDeps
            );
            if (entry.equals(currentEntry)) {
              this.db._log("REUSING (ALREADY SAVED)", {
                desc: this.desc,
                entry,
              });
            } else {
              this.db.saveEntry(this.desc, entry);
              this.db._log("REUSING (RE-SAVING)", { desc: this.desc, entry });
            }
            return {
              result: ok(cached),
              version: currentEntry.version,
            };
          }
        }

        const entry = new CacheEntry(result.value, calls, version, storeDeps);
        this.db.saveEntry(this.desc, entry);
        this.db._log("NOT REUSING", { desc: this.desc, entry, currentEntry });
      } else {
        this.db.removeEntry(this.desc);
        this.db._log("DELETED", { desc: this.desc });
      }
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
      this.db.removeEntry(this.desc);
    }
  }

  async preExec(): Promise<void> {
    if (this.isCacheable && this.firstExec) {
      this.inDisk = this.db.getEntry(this.desc);
    }
  }

  // If a computation only relies on "ctx" calls, then we can use this
  // Otherwise, use "preExec" instead, and rely on the "finishRoutine"
  // to give subscribers the correct version by using "responseEqual"
  async exec<Ctx extends CacheableCtx>(
    baseExec: RawComputationExec<Ctx, ResultTypeOfComputation<C>>,
    ctx: Ctx,
    runId: number
  ): Promise<ComputationResult<ResultTypeOfComputation<C>>> {
    if (this.isCacheable && this.firstExec) {
      const currentEntry = (this.inDisk = this.db.getEntry(this.desc));
      // If currentEntry.useDeps is false, it means the cache does not have the version of the dependencies we need or that the computation depends on more than just the "ctx" calls
      // So, it is not worth to run this, just execute the computation again and rely on "finishRoutine"
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
          return ok(cached);
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

    // Execute
    return baseExec(ctx);
  }
}
