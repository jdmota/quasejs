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

const func1 = IncrementalLib.register<
  number,
  number,
  { cell1: number; cell2: string }
>({
  name: "func1",
  version: 1,
  impl: (ctx, input) => {
    console.log("func1...", input);
    ctx.cell("cell1", 0);
    ctx.cell("cell2", "");
    return input + 1;
  },
});

const entry = IncrementalLib.register<void, number, {}>({
  name: "entry",
  version: 1,
  impl: async ctx => {
    console.log("func1 (a) read...");
    const val1 = await ctx.read(ctx.call(func1, 1));
    console.log("func1 (b) read...");
    const val2 = await ctx.read(ctx.call(func1, 2));
    return val1 + val2;
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
