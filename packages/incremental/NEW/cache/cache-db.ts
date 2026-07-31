import * as lmdb from "lmdb";
import path from "node:path";
import { inspect } from "node:util";
import { Logger } from "../../../util/logger";
import { assertion } from "../../../util/miscellaneous";
import { MissingConstructorSerializerError } from "../../../util/serialization";
import { HashMap } from "../../utils/hash-map";
import { type Version } from "../../utils/versions";
import type { AnyIncrementalFunctionCallDescription } from "../descriptions/functions";
import type { IncrementalCacheOpts } from "../runtime/backend";
import type {
  AnyIncrementalCellDescription,
  IncrementalAllocatedCellDescription,
  IncrementalCellDescription,
  IncrementalOutputCellDescription,
} from "../descriptions/cells";
import type { IncrementalCellRuntime } from "../runtime/cells";

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

export interface WithCacheKey {
  equal(other: unknown): boolean;
  hash(): number;
  getCacheKey(): string;
}

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
  ownedCells: readonly IncrementalAllocatedCellDescription<any>[];
  outputCell: IncrementalOutputCellDescription<any>;
}>;

type CacheEntry = CachedFunction | CachedCell<any>;

export type DB_Val = Readonly<CacheEntry>[];

export class CacheDB {
  public static DB_VERSION = 1;
  public static CACHE_DB_SESSION_SYM = Symbol.for(
    "quase_incremental_cache_session"
  );

  private readonly logger: Logger;
  private readonly dir: string;

  private readonly alive: HashMap<WithCacheKey, null> = new HashMap({
    equal: (a, b) => a.equal(b),
    hash: a => a.hash(),
  });

  private locked = false;
  private saveJobs: Map<string, Promise<void>>;
  private db: lmdb.RootDatabase<number | DB_Val, string | symbol>;

  constructor(
    private readonly opts: IncrementalCacheOpts,
    logger: Logger
  ) {
    this.dir =
      path.resolve(opts.dir) +
      path.sep +
      `quase_incremental_v${CacheDB.DB_VERSION}`;
    // this.logFile = this.dir + path.sep + `log${Date.now()}.txt`;
    this.saveJobs = new Map();
    this.logger = logger.createChildLogger("cache-db");
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

  lock() {
    this.locked = true;
  }

  private getKey(desc: WithCacheKey) {
    // max byte key size = 1978
    // UTF-8 characters can be 1 to 4 bytes long
    return desc.getCacheKey().slice(0, 1978 / 4); // estimate...
  }

  private corruptedKeys: Set<string> = new Set();

  private safeGetEntries(key: string) {
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

  private safeGet(desc: WithCacheKey): CacheEntry | undefined {
    const key = this.getKey(desc);
    const dbValue = this.safeGetEntries(key);
    for (const entry of dbValue) {
      if (entry.desc.equal(desc)) {
        this.alive.set(desc, null);
        return entry;
      }
    }
  }

  private saveEntry(desc: WithCacheKey, entry: CacheEntry) {
    if (this.locked) {
      return;
    }
    this.alive.set(desc, null);
    this.saveOne(this.getKey(desc), desc, entry);
  }

  private removeEntry(desc: WithCacheKey) {
    if (this.locked) {
      return;
    }
    this.alive.delete(desc);
    this.saveOne(this.getKey(desc), desc, null);
  }

  private saveOne(key: string, desc: WithCacheKey, entry: CacheEntry | null) {
    this.corruptedKeys.delete(key);
    const prevJob = this.saveJobs.get(key) ?? Promise.resolve();
    this.saveJobs.set(
      key,
      prevJob.then(() => this._saveOne(key, desc, entry))
    );
  }

  private async _saveOne(
    key: string,
    desc: WithCacheKey,
    entry: CacheEntry | null
  ) {
    try {
      await this.db.transaction(async () => {
        const entries = this.safeGetEntries(key);
        const idx = entries.findIndex(e => e.desc.equal(desc));
        const currentEntry = idx >= 0 ? entries[idx] : null;

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

        if (entry == null && currentEntry?.type === "function") {
          for (const cell of currentEntry.ownedCells) {
            this.deleteCell(cell);
          }
          this.deleteCell(currentEntry.outputCell);
        }
      });
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

  getCell<C>(desc: IncrementalCellDescription<C>): CachedCell<C> | undefined {
    const entry = this.safeGet(desc);
    if (entry?.type === "cell") {
      return entry;
    }
  }

  getFunc(
    desc: AnyIncrementalFunctionCallDescription
  ): CachedFunction | undefined {
    const entry = this.safeGet(desc);
    if (entry?.type === "function") {
      return entry;
    }
  }

  setCell<C>(desc: IncrementalCellDescription<C>, entry: CachedCell<C>) {
    this.logger.debug("Saving cell", desc.format(), entry.version);
    this.saveEntry(desc, entry);
  }

  setFunc(desc: AnyIncrementalFunctionCallDescription, entry: CachedFunction) {
    this.logger.debug("Saving function", desc.format());
    this.saveEntry(desc, entry);
  }

  deleteCell<C>(desc: IncrementalCellDescription<C>) {
    this.logger.debug("Deleting cell", desc.format());
    this.removeEntry(desc);
  }

  deleteFunc(desc: AnyIncrementalFunctionCallDescription) {
    this.logger.debug("Deleting function", desc.format());
    this.removeEntry(desc);
  }

  saveCell(cell: IncrementalCellRuntime<any>) {
    const { desc, result } = cell;
    if (result == null) {
      throw new Error(
        `Invariant violation: trying to save a cell with no result`
      );
    }
    this.setCell(desc, {
      type: "cell",
      desc,
      value: result[0],
      version: result[1],
    });
  }

  unsaveCell(cell: IncrementalCellRuntime<any>) {
    const { desc, result } = cell;
    if (result == null) {
      throw new Error(
        `Invariant violation: trying to save a cell with no result`
      );
    }
    this.deleteCell(desc);
  }

  async newGlobalSession() {
    // A global session number avoids confusion between
    // computation versions created in different sessions
    // We need to renew this session number when
    // loading for the first time from the disk
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
        const dbValue = this.safeGetEntries(key);
        for (const entry of dbValue) {
          if (!this.alive.has(entry.desc)) {
            this.logger.debug("=== GC OLD ENTRY ===", entry.desc);
            this.saveOne(key, entry.desc, null);
          } else if (key !== this.getKey(entry.desc)) {
            this.logger.debug("=== GC ENTRY WITH OUTDATED KEY ===", entry.desc);
            this.saveOne(key, entry.desc, null);
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
