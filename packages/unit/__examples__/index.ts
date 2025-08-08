import { defaultOpts } from "../runnable-desc";
import { Reporter } from "../reporter";
import { RunnerPool } from "../runner-pool";

const pool = new RunnerPool(
  defaultOpts,
  {
    ["--"]: [],
    files: [
      "packages/unit/__examples__/example.ts",
      "packages/unit/__examples__/snapshot_example.ts",
    ],
    ignoreFiles: [],
    filterFiles: () => true,
    worker: "processes",
    maxWorkers: 1,
    verbose: true,
    errorOpts: { diff: true, stack: true, codeFrame: true, stackIgnore: null },
    // debug: true,
  },
  defaultOpts
);

const reporter = new Reporter(pool, pool.runnerGlobalOpts);

pool.executeTests();

// yarn n packages/unit/__examples__/index.ts
