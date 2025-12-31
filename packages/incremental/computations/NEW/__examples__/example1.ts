import { IncrementalLib } from "../incremental-lib";
import { sameValue } from "../values";

const lib = new IncrementalLib({
  fs: {
    onEvent({ event, path }) {
      console.log("=== CHANGED", event, path, "===");
    },
  },
  onUncaughtError: ({ description, error }) => {
    console.log("Uncaught error", error, description);
  },
  canInvalidate: false,
  cache: false,
});

const func1 = IncrementalLib.register({
  name: "func1",
  version: 1,
  inputDef: sameValue<number>(),
  outputDef: sameValue<number>(),
  cellsDef: {
    cell1: sameValue<number>(),
    cell2: sameValue<string>(),
  },
  impl: (ctx, input) => {
    console.log("func1...", input);
    ctx.cell("cell1", 0);
    ctx.cell("cell2", "");
    return input + 1;
  },
});

const entry = IncrementalLib.register({
  name: "entry",
  version: 1,
  inputDef: sameValue<void>(),
  outputDef: sameValue<number>(),
  cellsDef: {},
  impl: async ctx => {
    console.log("func1 (a) read...");
    const val1 = await ctx.read(ctx.call(func1, 1));
    console.log("func1 (b) read...");
    const val2 = await ctx.read(ctx.call(func1, 2));
    return val1 + val2;
  },
});

async function main() {
  console.log("Started...");
  console.log("Result", await lib.call(entry, undefined));
}

main();
