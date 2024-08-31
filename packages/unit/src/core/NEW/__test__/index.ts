import { defaultOpts } from "../runnable-desc";
import { Reporter } from "../reporter";
import { RunnerPool } from "../runner-pool";

const pool = new RunnerPool(
  defaultOpts,
  {
    files: [],
    worker: "workers",
    maxWorkers: 1,
    verbose: true,
    errorOpts: { diff: true, stack: true, codeFrame: true, stackIgnore: null },
  },
  defaultOpts,
  [
    "file:///C:/Users/jdmota/Desktop/GitHub/quasejs/packages/unit/src/core/NEW/__test__/example.ts",
  ]
);

const reporter = new Reporter(pool);

pool.executeTests();
