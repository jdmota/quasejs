import { Options } from "./types";
import { Builder } from "./builder/builder";
import Reporter from "./reporter";

export async function cli(options: Options) {
  const builder = new Builder(options);
  const reporter = new Reporter({}, builder); // TODO custom reporter and options

  process.once("SIGINT", () => {
    builder.emit("sigint");
    builder.stop();
  });

  const { result, firstJob } = await builder.start();

  return {
    reporter,
    builder,
    setupResult: result,
    firstJob,
  };
}

export { Builder };

export { schema, normalizeOptions } from "./options";
