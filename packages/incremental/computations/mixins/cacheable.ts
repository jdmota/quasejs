import * as lmdb from "lmdb";
import fsextra from "fs-extra";
import path from "node:path";
import { inspect } from "node:util";
import { never } from "../../../util/miscellaneous";
import { ResultTypeOfComputation } from "../../incremental-lib";
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

export type CachedGet = {
  readonly kind: "get";
  readonly desc: ComputationDescription<
    RawComputation<any, any> & SubscribableComputation<any>
  >;
  readonly version: number;
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
    readonly version: number,
    readonly useDeps: boolean,
    readonly alive: boolean // If true, keep it. Otherwise, GC it
  ) {}
}

type CachedDepInDisk =
  | {
      readonly kind: "get";
      readonly desc: ComputationDescription<any>;
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
};

export type CacheSaveOpts = {
  readonly garbageCollect: boolean;
};

type DB_Val = Readonly<CacheEntryInDisk>[];

export class CacheDB {
  private static DB_VERSION = 1;
  private readonly dir: string;
  private readonly logFile: string;

  private readonly map: HashMap<
    ComputationDescription<any>,
    CacheEntry<any> | null // Null for deleted entries
  > = new HashMap(defaultValDef);

  private locked = false;
  private lastLog: Promise<void>;

  constructor(dir: string) {
    this.dir =
      path.resolve(dir) + path.sep + `quase_incremental_v${CacheDB.DB_VERSION}`;
    this.logFile = this.dir + path.sep + `log${Date.now()}.txt`;
    this.lastLog = Promise.resolve();
  }

  _log(message: string, value: unknown = null) {
    this.lastLog = this.lastLog.then(() => {
      return fsextra.appendFile(
        this.logFile,
        `\n\n${message}\n${inspect(value)}`
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
    entry: CacheEntry<ResultTypeOfComputation<C>>
  ) {
    if (this.locked) {
      return;
    }
    this.map.set(desc, entry);
  }

  delete(desc: ComputationDescription<any>) {
    if (this.locked) {
      return;
    }
    this.map.set(desc, null);
  }

  // When loading, we assign -1 to the versions to avoid confusion
  // between versions cached in disk (from a previous session)
  // and versions created at runtime in this session
  async load() {
    const cacheDir = this.dir;
    const db = lmdb.open<DB_Val, string>({
      path: cacheDir,
    });

    this._log("=== LOADING CACHE ===");

    // TODO loading everything to memory, is it ok? yes, big blobs should be handled separately
    for (const key of db.getKeys()) {
      try {
        const dbValue = db.get(key) ?? [];
        for (const entry of dbValue) {
          this.set(entry.desc, this.unpackEntry(entry));
          this._log("LOADED ENTRY", entry);
        }
      } catch (err) {
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

    await db.close();

    this._log("=== CACHE LOADED ===");

    this.printErrors();

    await this.lastLog;
  }

  // When saving, we check that when a computation has a dependency, that version of the dependency is stored (see packEntry)
  // This allows us to have a normalized cache and not store versions in disk (which in turn avoids future confusions)
  // When loading, we assign -1 to all of them (see load())
  // (e.g., it is possible that a dependency version is no longer available
  // if the user interrupted the incremental library in the middle of something running)
  async save(opts: CacheSaveOpts) {
    const cacheDir = this.dir;
    const db = lmdb.open<DB_Val, string>({
      path: cacheDir,
    });

    this._log("=== SAVING CACHE ===");

    for (const [desc, entry] of this.map) {
      const key = desc.key().slice(0, 1978);
      const packedEntry = entry ? this.packEntry(desc, entry, opts) : null;
      try {
        await db.transaction(async () => {
          const entries = db.get(key) ?? [];

          for (let i = 0; i < entries.length; i++) {
            if (entries[i].desc.equal(desc)) {
              if (packedEntry) {
                entries[i] = packedEntry;
              } else {
                entries.splice(i, 1);
              }
              await db.put(key, entries);
              return;
            }
          }

          if (packedEntry) {
            entries.push(packedEntry);
            await db.put(key, entries);
          }
        });

        if (packedEntry) {
          this._log("SAVED ENTRY", packedEntry);
        } else {
          this._log("GC ENTRY", desc);
        }
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

    await db.close();

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

  private printErrors() {
    for (const error of this.errors) {
      console.error("Error when saving cache:", error);
    }

    if (this.missingSerializers.size) {
      console.error("Missing serializers for:", ...this.missingSerializers);
    }
  }

  private unpackEntry(entry: CacheEntryInDisk) {
    const { value, deps, useDeps } = entry;
    return new CacheEntry(
      value,
      deps.map(d => {
        switch (d.kind) {
          case "get":
            return {
              kind: "get",
              desc: d.desc,
              version: -1,
            };
          case "compute":
            return {
              kind: "compute",
              desc: d.desc,
            };
          default:
            never(d);
        }
      }),
      -1,
      useDeps,
      false // When unpacking from disk, set this flag to false
    );
  }

  private packEntry<Res>(
    desc: ComputationDescription<any>,
    entry: CacheEntry<Res>,
    opts: CacheSaveOpts
  ): CacheEntryInDisk | null {
    if (opts.garbageCollect && !entry.alive) {
      return null;
    }
    const useDeps =
      entry.useDeps &&
      entry.deps.every(d =>
        d.kind === "get" ? this.get(d.desc)?.version === d.version : true
      );
    return {
      desc,
      value: entry.value,
      deps: useDeps
        ? entry.deps.map(d => ({
            kind: d.kind,
            desc: d.desc,
          }))
        : [],
      useDeps,
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
              this.db.set(this.desc, entry);
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
        this.db.set(this.desc, entry);
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
                        if (!result.ok || version !== dep.version) {
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
