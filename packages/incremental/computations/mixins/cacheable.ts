import * as lmdb from "lmdb";
import fsextra from "fs-extra";
import path from "node:path";
import { inspect } from "node:util";
import { never } from "../../../util/miscellaneous";
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
import {
  sameVersion,
  addSessionId,
  InDiskVersion,
  Version,
} from "../../utils/versions";

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

class CacheEntry<Res> {
  constructor(
    readonly value: Res,
    readonly deps: readonly CachedDep[],
    readonly version: Version,
    readonly useDeps: boolean,
    readonly alive: boolean // If true, keep it. Otherwise, GC it
  ) {}
}

type CachedDepInDisk =
  | {
      readonly kind: "get";
      readonly desc: ComputationDescription<any>;
      readonly version: InDiskVersion;
    }
  | {
      readonly kind: "compute";
      readonly desc: ComputationDescription<any>;
    };

type CacheEntryInDisk = {
  readonly desc: ComputationDescription<any>;
  readonly value: unknown;
  readonly deps: readonly CachedDepInDisk[];
  readonly useDeps: boolean;
  readonly version: InDiskVersion;
};

export type CacheSaveOpts = {
  readonly garbageCollect: boolean;
};

type DB_Val = Readonly<CacheEntryInDisk>[];

export class CacheDB {
  private static DB_VERSION = 1;
  private static CACHE_DB_SESSION_SYM = Symbol.for(
    "quase_incremental_cache_session"
  );

  private readonly dir: string;
  private readonly logFile: string;

  private readonly map: HashMap<
    ComputationDescription<any>,
    CacheEntry<any> | null // Null for deleted entries
  > = new HashMap(defaultValDef);
  private globalSession = 0;

  private locked = false;
  private lastLog: Promise<void>;
  private saveJobs: Map<string, Promise<void>>;
  private db: lmdb.RootDatabase<number | DB_Val, string | symbol>;

  constructor(private readonly opts: IncrementalOpts) {
    this.dir =
      path.resolve(opts.cacheDir) +
      path.sep +
      `quase_incremental_v${CacheDB.DB_VERSION}`;
    this.logFile = this.dir + path.sep + `log${Date.now()}.txt`;
    this.lastLog = Promise.resolve();
    this.saveJobs = new Map();
    this.db = this.openDB();
  }

  _log(message: string, value?: unknown) {
    this.lastLog = this.lastLog.then(() => {
      return fsextra.appendFile(
        this.logFile,
        `\n\n${message}${value === undefined ? "" : "\n" + inspect(value)}`
      );
    });
  }

  lock() {
    this.locked = true;
  }

  get<C extends AnyRawComputation>(desc: ComputationDescription<C>) {
    return this.map.get(desc) as
      | CacheEntry<ResultTypeOfComputation<C>>
      | null
      | undefined;
  }

  set<C extends AnyRawComputation>(
    desc: ComputationDescription<C>,
    entry: CacheEntry<ResultTypeOfComputation<C>>,
    save: boolean
  ) {
    if (this.locked) {
      return;
    }
    this.map.set(desc, entry);
    if (save) this.saveOne(desc, entry);
  }

  delete(desc: ComputationDescription<any>) {
    if (this.locked) {
      return;
    }
    this.map.set(desc, null);
  }

  private openDB() {
    return lmdb.open<
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

  // TODO loading everything to memory, is it ok? yes, big blobs should be handled separately
  async load() {
    // A global version number is stored in the DB
    // and associated with entries that are going to be saved now
    // This way nothing is confused, even if we crash in the middle of something
    this.globalSession = await this.db.transaction(async () => {
      const session = checkNumber(
        this.db.get(CacheDB.CACHE_DB_SESSION_SYM) || 1
      );
      const newSession = session + 1;
      await this.db.put(CacheDB.CACHE_DB_SESSION_SYM, newSession);
      return newSession;
    });

    const deleteKeys = [];

    this._log("=== NEW GLOBAL SESSION ===", this.globalSession);

    this._log("=== LOADING CACHE ===");

    for (const key of this.db.getKeys()) {
      if (typeof key === "symbol") continue;
      try {
        const dbValue = this.db.get(key) ?? [];
        for (const entry of checkArray(dbValue)) {
          this.set(entry.desc, this.unpackEntry(entry), false);
          this._log("LOADED ENTRY", entry);
        }
      } catch (err) {
        deleteKeys.push(key);
        this._log(
          "ERROR",
          this.addError(
            new Error(`Error loading entries with db key ${inspect(key)}`, {
              cause: err,
            })
          )
        );
      }
    }

    // Delete keys that may contain invalid data
    // (e.g., due to a serialization format version change)
    await Promise.all(deleteKeys.map(key => this.db.remove(key)));

    this._log("=== CACHE LOADED ===");

    this.printErrors();

    await this.lastLog;
  }

  private getKey(desc: ComputationDescription<any>) {
    // max byte key size = 1978
    // UTF-8 characters can be 1 to 4 bytes long
    return desc.key().slice(0, 1978 / 4); // estimate...
  }

  private saveOne(desc: ComputationDescription<any>, entry: CacheEntry<any>) {
    const key = this.getKey(desc);
    const prevJob = this.saveJobs.get(key) ?? Promise.resolve();
    this.saveJobs.set(
      key,
      prevJob.then(() => this._saveOne(key, desc, entry))
    );
  }

  private async _saveOne(
    key: string,
    desc: ComputationDescription<any>,
    entry: CacheEntry<any>
  ) {
    const packedEntry = this.packEntry(desc, entry);
    try {
      await this.db.transaction(async () => {
        const entries = checkArray(this.db.get(key) ?? []);

        for (let i = 0; i < entries.length; i++) {
          if (entries[i].desc.equal(desc)) {
            entries[i] = packedEntry;
            await this.db.put(key, entries);
            return;
          }
        }

        entries.push(packedEntry);
        await this.db.put(key, entries);
      });

      this._log("SAVED ENTRY", packedEntry);
    } catch (err) {
      this._log(
        "ERROR",
        this.addError(
          new Error(`Error saving entry with description ${inspect(desc)}`, {
            cause: err,
          })
        )
      );
    }
  }

  // Save cache DB
  // (if this run was interrupted, don't GC to avoid deleting useful entries that didn't get the chance to be flagged as "alive")
  async save(interrupted: boolean) {
    const gc = !interrupted && this.opts.cacheSaveOpts.garbageCollect;

    this._log("=== SAVING CACHE ===");

    for (const [key, job] of this.saveJobs) {
      await job;
    }

    // GC
    if (gc) {
      for (const [desc, entry] of this.map) {
        if (entry == null || !entry.alive) {
          const key = this.getKey(desc);
          try {
            const removed = await this.db.transaction(async () => {
              const entries = checkArray(this.db.get(key) ?? []);
              for (let i = 0; i < entries.length; i++) {
                if (entries[i].desc.equal(desc)) {
                  entries.splice(i, 1);
                  await this.db.put(key, entries);
                  return true;
                }
              }
              return false;
            });
            if (removed) {
              this._log("GC ENTRY", desc);
            }
          } catch (err) {
            this._log(
              "ERROR",
              this.addError(
                new Error(`Error gc entry with description ${inspect(desc)}`, {
                  cause: err,
                })
              )
            );
          }
        }
      }
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
      console.error("Error when saving cache:", this.errors[this.nextErrorIdx]);
    }

    if (this.missingSerializers.size) {
      console.error("Missing serializers for:", ...this.missingSerializers);
    }
  }

  private unpackEntry(entry: CacheEntryInDisk) {
    const { value, deps, version, useDeps } = entry;
    return new CacheEntry(
      value,
      deps,
      version,
      useDeps,
      false // When unpacking from disk, set this flag to false
    );
  }

  private packEntry<Res>(
    desc: ComputationDescription<any>,
    entry: CacheEntry<Res>
  ): CacheEntryInDisk {
    return {
      desc,
      value: entry.value,
      deps: entry.useDeps
        ? entry.deps.map(d => {
            switch (d.kind) {
              case "get":
                return {
                  kind: "get",
                  desc: d.desc,
                  version: addSessionId(d.version, this.globalSession),
                };
              case "compute":
                return d;
              default:
                never(d);
            }
          })
        : [],
      useDeps: entry.useDeps,
      version: addSessionId(entry.version, this.globalSession),
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

  constructor(
    public readonly source: C &
      MaybeDependentComputation &
      MaybeParentComputation,
    public readonly desc: ComputationDescription<C>
  ) {
    this.db = source.registry.db;
    this.isCacheable = true;
    this.firstExec = true;
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
            this.db.delete(this.desc);
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

        let currentEntry;
        if (firstExec) {
          currentEntry = this.db.get(this.desc);
          if (currentEntry) {
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
                storeDeps,
                true
              );
              this.db.set(this.desc, entry, true);
              this.db._log("REUSING", { desc: this.desc, entry });
              return {
                result: ok(cached),
                version: currentEntry.version,
              };
            }
          }
        }

        const entry = new CacheEntry(
          result.value,
          calls,
          version,
          storeDeps,
          true
        );
        this.db.set(this.desc, entry, true);
        this.db._log("NOT REUSING", { desc: this.desc, entry, currentEntry });
      } else {
        this.db.delete(this.desc);
        this.db._log("DELETED", { desc: this.desc });
      }
    }
    return original;
  }

  invalidateRoutine() {
    if (this.isCacheable) {
      this.firstExec = false;
      this.db.delete(this.desc);
    }
  }

  deleteRoutine() {
    if (this.isCacheable) {
      this.firstExec = false;
      this.db.delete(this.desc);
    }
  }

  // If a computation only relies on "ctx" calls, then we can use this
  // Otherwise, do not use this, instead, just rely on the "finishRoutine"
  // to give subscribers the correct version by using "responseEqual"
  async exec<Ctx extends CacheableCtx>(
    baseExec: RawComputationExec<Ctx, ResultTypeOfComputation<C>>,
    ctx: Ctx,
    runId: number
  ): Promise<ComputationResult<ResultTypeOfComputation<C>>> {
    if (this.isCacheable && this.firstExec) {
      const currentEntry = this.db.get(this.desc);
      // If currentEntry.useDeps is false, it means the cache does not have the version of the dependency we need or that the computation depends on more than just the "ctx" calls
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
