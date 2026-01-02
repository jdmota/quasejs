import * as lmdb from "lmdb";
import path from "node:path";
import { CacheDB, checkArray, type DB_Val } from "./cache-db";
import { inspect } from "node:util";

export class CachePrinter {
  private readonly dir: string;
  private db: lmdb.RootDatabase<number | DB_Val, string | symbol>;

  constructor(dir: string) {
    this.dir =
      path.resolve(dir) + path.sep + `quase_incremental_v${CacheDB.DB_VERSION}`;
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

  async print() {
    for (const key of this.db.getKeys()) {
      if (typeof key === "symbol") continue;
      try {
        const dbValue = checkArray(this.db.get(key) ?? []);
        let i = 0;
        for (const entry of dbValue) {
          console.log(`==== ${key}[${i++}] ====`);
          console.log(inspect(entry, { colors: true }));
          console.log("===============");
        }
      } catch (err) {
        console.log(`==== ERROR ${key} ====`);
        console.log(inspect(err, { colors: true }));
        console.log("===============");
      }
    }
  }
}
