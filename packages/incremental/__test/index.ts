import { newSimpleComputation } from "../computations/simple";
import { ComputationRegistry } from "../incremental-lib";
import { newComputationPool } from "../computations/job-pool/pool";
import { error, ok } from "../utils/result";
import { FileSystem } from "../computations/file-system/file-system";
import path from "path";
import { readJSON } from "fs-extra";

function deepClone(value: any): any {
  if (Array.isArray(value)) {
    return value.map(v => deepClone(v));
  }
  if (value != null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, deepClone(v)])
    );
  }
  return value;
}

type FILE = {
  content: string;
  deps: string[];
};

const fs = new FileSystem();

const pool = newComputationPool<string, FILE>({
  async startExec(ctx) {
    console.log("Running entry pool...");

    ctx.compute("index.ts");

    return ok(undefined);
  },
  async exec(ctx) {
    console.log("Running pool job...", ctx.request);

    const json: FILE = await fs.depend(
      ctx,
      path.resolve(__dirname, "fs", ctx.request + ".json"),
      p => readJSON(p)
    );

    if (json) {
      for (const dep of json.deps) {
        ctx.compute(dep);
      }
      return ok(json);
    }
    return error(new Error(`${ctx.request} not found`));
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
      return a.deps.length;
    },
    equal(a, b) {
      return a === b;
    },
  },
});

export async function main() {
  const controller = ComputationRegistry.run(async ctx => {
    console.log("Running main computation...");
    const results = await ctx.get(pool);

    if (results.ok) {
      console.log("Results", results.value.size());
      for (const [key, value] of results.value) {
        console.log(key, value.ok ? value.value : value.error);
      }
    } else {
      console.log(results);
    }
    return results;
  });

  process.once("SIGINT", () => {
    console.log("SIGINT...");
    controller.finish();
  });

  const result = await controller.promise;
  console.log(result);
}

main().catch(error => console.log(error));

// yarn n packages\incremental\__test\index.ts
// yarn i packages\incremental\__test\index.ts
