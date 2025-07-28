import path from "path";
import fsextra from "fs-extra";
import { serializationDB } from "../utils/serialization-db";
import { strictArrayEquals } from "../../util/miscellaneous";
import { Logger } from "../../util/logger";
import { ok } from "../utils/result";
import { anyValue } from "../utils/hash-map";
import { IncrementalLib } from "../incremental-lib";

type FILE = {
  readonly content: string;
  readonly deps: string[];
};

const pool = IncrementalLib.newPool<string, FILE>(
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

const number = IncrementalLib.new(
  serializationDB.uniqueObjDB.register("MY_NUMBER_CONFIG", 1, {
    key: "number",
    async exec(ctx) {
      return ok(123456789);
    },
    requestDef: anyValue,
    responseDef: anyValue,
  })
);

const stateful = IncrementalLib.newStateful<any, any, [number, number]>(
  serializationDB.uniqueObjDB.register("MY_STATEFUL_CONFIG", 1, {
    key: "stateful",
    init(ctx) {
      let num = 0;
      let num2 = 0;
      ctx.listen(number, event => {
        console.log("EVENT", event.result);
        if (event.result.ok) {
          num2 = event.result.value;
          if (num !== 0) {
            ctx.done(ok([num, num2]));
          }
        }
      });

      ctx.listen(pool, event => {
        console.log("EVENT", event);
        num++;
        if (event.type === "done") {
          if (num2 !== 0) {
            ctx.done(ok([num, num2]));
          }
        }
      });
    },
    keyDef: anyValue,
    valueDef: anyValue,
    doneDef: anyValue,
  })
);

const bundler = IncrementalLib.new(
  serializationDB.uniqueObjDB.register("MY_BUNDLER_CONFIG", 1, {
    key: "bundler",
    async exec(ctx) {
      console.log("Running bundler...");

      const [results, statefulValue] = await Promise.all([
        ctx.getOk(pool),
        ctx.getOk(stateful),
      ]);
      console.log("STATEFUL", statefulValue);

      let output = [];
      for (const [key, value] of results) {
        if (value.ok) {
          output.push(`// ${key}\n${value.value.content}`);
        } else {
          output.push(`// ${key}\nERROR: ${value.error}`);
        }
      }
      return ok(output.join("\n\n"));
    },
    requestDef: anyValue,
    responseDef: anyValue,
  })
);

export async function main() {
  const controller = await IncrementalLib.run({
    entry: bundler,
    onResult(result) {
      console.log("ON RESULT", result);
    },
    onUncaughtError(info) {
      console.error("Uncaught Error", info);
    },
    fs: {
      onEvent({ event, path }) {
        console.log("=== CHANGED", event, path, "===");
      },
    },
    cache: {
      dir: "packages/incremental/__test/cache",
      garbageCollect: true,
      logger: new Logger("CACHE"),
    },
  });

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
