import path from "path";
import fsextra from "fs-extra";
import { serializationDB } from "../utils/serialization-db";
import { strictArrayEquals } from "../../util/miscellaneous";
import { ComputationRegistry } from "../incremental-lib";
import { newComputationPool } from "../computations/job-pool/pool";
import { newStatefulComputation } from "../computations/stateful";
import { ComputationResult, ok } from "../utils/result";

type FILE = {
  readonly content: string;
  readonly deps: string[];
};

const pool = newComputationPool<string, FILE>(
  serializationDB.uniqueObjDB.register("MY_POOL_CONFIG", 1, {
    key: "MY_POOL_CONFIG",
    async startExec(ctx) {
      console.log("Running entry job...");

      ctx.compute("index.ts");

      return ok(undefined);
    },
    async exec(ctx) {
      console.log("Running pool job...", ctx.request);

      const json: FILE = await ctx.fs(
        path.resolve(import.meta.dirname, "fs", ctx.request + ".json"),
        p => fsextra.readJson(p)
      );

      for (const dep of json.deps) {
        ctx.compute(dep);
      }
      return ok(json);
    },
    requestDef: {
      hash(a) {
        return a.length;
      },
      equal(a, b) {
        return a === b;
      },
    },
    responseDef: {
      hash(a) {
        return a.content.length * a.deps.length;
      },
      equal(a, b) {
        return a.content === b.content && strictArrayEquals(a.deps, b.deps);
      },
    },
  })
);

const stateful = newStatefulComputation({
  init(ctx) {
    let num = 0;
    ctx.listen(pool, event => {
      console.log("EVENT", event);
      num++;
      if (event.type === "done") {
        ctx.done(ok(num));
      }
    });
  },
  keyDef: {
    hash(a) {
      return 0;
    },
    equal(a, b) {
      return a === b;
    },
  },
  valueDef: {
    hash(a) {
      return 0;
    },
    equal(a, b) {
      return a === b;
    },
  },
});

export async function main() {
  const controller = await ComputationRegistry.run(
    async ctx => {
      let map: Map<string, ComputationResult<FILE>> | null = null;
      ctx.cleanup(() => {
        console.log("Cleanup. Previous results:", map);
      });

      console.log("Running main computation...");
      const results = await ctx.get(pool);

      if (results.ok) {
        map = new Map(results.value);

        console.log("Results", results.value.size());
        for (const [key, value] of results.value) {
          console.log(key, value.ok ? value.value : value.error);
        }
      } else {
        console.log("ERROR POOL RESULTS", results);
      }

      const statefulNum = await ctx.get(stateful);
      console.log("STATEFUL NUM", statefulNum);

      return results;
    },
    {
      cacheDir: "packages/incremental/__test/cache",
      cacheSaveOpts: {
        garbageCollect: true,
      },
    }
  );

  return new Promise(resolve => {
    process.once("SIGINT", () => {
      console.log("SIGINT...");
      resolve(controller.finish());
    });
  });
}

main().catch(error => console.log("MAIN ERROR", error));

// yarn n packages\incremental\__test\index.ts
// yarn i packages\incremental\__test\index.ts
