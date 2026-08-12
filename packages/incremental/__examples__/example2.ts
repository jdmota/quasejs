import path from "node:path";
import fs from "fs-extra";
import { IncrementalLib } from "../incremental-lib";
import { Logger } from "../../util/logger";

const lib = new IncrementalLib<{}>({
  fs: {
    onEvent({ event, path }) {
      console.log("=== CHANGED", event, path, "===");
    },
  },
  onUncaughtError: ({ description, error }) => {
    console.log("Uncaught error", error, description);
  },
  logger: Logger.create("incremental"),
  canInvalidate: false,
  cache: false,
});

type FILE = {
  readonly content: string;
  readonly deps: string[];
};

const processFile = IncrementalLib.register<string, FILE, {}>({
  name: "processFile",
  version: 1,
  impl: async (ctx, input) => {
    console.log("processFile...", input);

    const json: FILE = await ctx.fs(
      path.resolve(import.meta.dirname, "fs", input + ".json"),
      p => fs.readJson(p)
    );

    return json;
  },
});

const entry = IncrementalLib.register<void, ReadonlyMap<string, FILE>, {}>({
  name: "entry",
  version: 1,
  impl: async ctx => {
    console.log("entry...");

    const jobs: string[] = ["index.ts"];
    const files = new Map<string, FILE>();

    while (jobs.length) {
      const job = jobs.pop()!;
      if (!files.has(job)) {
        const file = await ctx.read(ctx.call(processFile, job));
        files.set(job, file);
        for (const dep of file.deps) {
          jobs.push(dep);
        }
      }
    }

    return files;
  },
});

async function main() {
  process.once("SIGINT", () => {
    console.log("SIGINT...");
    lib.close();
  });

  console.log("Started...");
  console.log("Result", await lib.call(entry, undefined));
}

main();
