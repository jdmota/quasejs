import { newComputationBuilder } from "../computations/basic";
import { newSimpleComputation } from "../computations/simple";
import { ComputationRegistry } from "../incremental-lib";
import { newComputationPool } from "../computations/job-pool/pool";
import { error, ok } from "../utils/result";

const files = {
  "index.ts": {
    content: "content of index.ts",
    deps: ["a.ts", "b.ts"],
  },
  "a.ts": {
    content: "content of a.ts",
    deps: ["util.ts"],
  },
  "b.ts": {
    content: "content of b.ts",
    deps: ["util.ts"],
  },
  "util.ts": {
    content: "content of util.ts",
    deps: [],
  },
} as const;

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

type FS = {
  [key in string]: FILE | undefined;
};

const fs: FS = deepClone(files);

const pool = newComputationPool<string, FILE>({
  async startExec(ctx) {
    console.log("Running entry pool...");

    ctx.compute("index.ts");

    return ok(undefined);
  },
  async exec(ctx) {
    console.log("Running pool job...", ctx.request);

    const file = fs[ctx.request];
    if (file) {
      for (const dep of file.deps) {
        ctx.compute(dep);
      }
      return ok(file);
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

const mainComputation = newSimpleComputation({
  root: true,
  async exec(ctx) {
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
    return ok(undefined);
  },
});

export async function main() {
  console.log("Starting main...");
  const registry = new ComputationRegistry();
  registry.make(mainComputation);
  const errors = await registry.run();
  console.log("Errors", errors);
}

main().catch(error => console.log(error));

// yarn n packages\incremental\__test\index.ts
