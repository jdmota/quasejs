import * as lmdb from "lmdb";
import fsextra from "fs-extra";
import path from "node:path";
import { inspect } from "node:util";
import { finished } from "node:stream/promises";
import { Logger, LoggerVerboseLevel } from "../../../util/logger";
import { arrayEquals, assertion, never } from "../../../util/miscellaneous";
import { MissingConstructorSerializerError } from "../../../util/serialization";
import type {
  IncrementalCacheOpts,
  ResultTypeOfComputation,
} from "../../incremental-lib";
import { type ValueDefinition, HashMap, objValue } from "../../utils/hash-map";
import { sameVersion, type Version } from "../../utils/versions";
import { type AnyRawComputation, RawComputation } from "../raw";
import type { ComputationDescription } from "../description";
import { type SubscribableComputation } from "../mixins/subscribable";
import { type ChildComputation } from "../mixins/child";

export function checkArray<T>(val: T[] | number): T[] {
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

type CachedGet = {
  readonly kind: "get";
  readonly desc: ComputationDescription<
    RawComputation<any, any> & SubscribableComputation<any>
  >;
  readonly version: Version;
};

type CachedCompute = {
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

export function sameCacheEntry<C extends AnyRawComputation>(
  a: CacheEntry<C>,
  b: CacheEntry<C>
) {
  return (
    a.value === b.value &&
    a.useDeps === b.useDeps &&
    sameVersion(a.version, b.version) &&
    arrayEquals(a.deps, b.deps, sameDep)
  );
}

export type CacheEntry<C extends AnyRawComputation> = {
  readonly desc: ComputationDescription<C>;
  readonly value: ResultTypeOfComputation<C>;
  readonly deps: readonly CachedDep[];
  readonly useDeps: boolean;
  readonly version: Version;
};

export type DB_Val = Readonly<CacheEntry<any>>[];

export class CacheDB {
  public static DB_VERSION = 1;
  public static CACHE_DB_SESSION_SYM = Symbol.for(
    "quase_incremental_cache_session"
  );

  private readonly dir: string;
  private readonly logFile: string;

  private readonly alive: HashMap<ComputationDescription<any>, null> =
    new HashMap(defaultValDef);

  public readonly logger: Logger;
  private logFileStream: fsextra.WriteStream;

  private locked = false;
  private saveJobs: Map<string, Promise<void>>;
  private db: lmdb.RootDatabase<number | DB_Val, string | symbol>;

  constructor(private readonly opts: IncrementalCacheOpts) {
    this.dir =
      path.resolve(opts.dir) +
      path.sep +
      `quase_incremental_v${CacheDB.DB_VERSION}`;
    this.logFile = this.dir + path.sep + `log${Date.now()}.txt`;
    this.logger = opts.logger;
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
    this.logFileStream = fsextra.createWriteStream(this.logFile);
    this.logger.setStream(process.stderr, l => l <= LoggerVerboseLevel.WARN);
    this.logger.setStream(
      process.stdout,
      l => LoggerVerboseLevel.WARN < l && l <= LoggerVerboseLevel.LOG
    );
    this.logger.setStream(this.logFileStream, LoggerVerboseLevel.ALL);
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
      this.logger.error(
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
    return desc.getCacheKey().slice(0, 1978 / 4); // estimate...
  }

  getEntry<C extends AnyRawComputation>(
    desc: ComputationDescription<C>
  ): CacheEntry<C> | undefined {
    const key = this.getKey(desc);
    const dbValue = this.safeGet(key);
    for (const entry of dbValue) {
      if (entry.desc.equal(desc)) {
        this.alive.set(desc, null);
        return entry satisfies CacheEntry<any> as CacheEntry<C>;
      }
    }
  }

  saveEntry<C extends AnyRawComputation>(
    desc: ComputationDescription<C>,
    entry: CacheEntry<C>
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
    try {
      await this.db.transaction(async () => {
        const entries = this.safeGet(key);
        const idx = entries.findIndex(e => e.desc.equal(desc));

        if (entry) {
          if (idx >= 0) {
            entries[idx] = entry;
          } else {
            entries.push(entry);
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

      if (entry) {
        this.logger.debug("SAVED ENTRY", entry);
      } else {
        this.logger.debug("DELETED ENTRY", desc);
      }
    } catch (err) {
      this.logger.error(
        this.addError(
          new Error(
            `Error ${entry ? "saving" : "deleting"} entry with description ${inspect(desc)}`,
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
    const gc = !interrupted && this.opts.garbageCollect;

    this.logger.debug("=== SAVING CACHE ===");

    if (gc) {
      for (const key of this.db.getKeys()) {
        if (typeof key === "symbol") continue;
        const dbValue = this.safeGet(key);
        for (const entry of dbValue) {
          if (!this.alive.has(entry.desc)) {
            this.logger.debug("=== GC OLD ENTRY ===", entry.desc);
            this.saveOne(entry.desc, null);
          } else if (key !== this.getKey(entry.desc)) {
            this.logger.debug("=== GC ENTRY WITH OUTDATED KEY ===", entry.desc);
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
      this.logger.debug("=== REMOVE CORRUPTED KEY ===", key);
    }

    await this.db.close();

    this.logger.debug("=== SAVED CACHE ===");

    this.printMissingSerializers();

    await finished(this.logFileStream);
  }

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
    return error;
  }

  private printMissingSerializers() {
    if (this.missingSerializers.size) {
      this.logger.error("Missing serializers for:", ...this.missingSerializers);
    }
  }
}
