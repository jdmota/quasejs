import globby from "globby";
import ora from "ora";
import turbocolor from "turbocolor";
import { printError } from "./node-runner/util";
import validateOptions, { schema } from "./core/validate-options";
import NodeReporter from "./reporters/node";
import { NodeRunner } from "./node-runner";
import { CliOptions } from "./types";

export { schema };

export default async function cli({
  input,
  flags,
  options,
  configLocation,
}: {
  input: string[];
  flags: { ["--"]: string[] | undefined };
  options: CliOptions;
  configLocation: string | undefined;
}) {
  if (input.length > 0) {
    options.files = input;
  }

  let normalizedOpts;

  try {
    normalizedOpts = validateOptions(options, flags["--"], configLocation);
  } catch (err) {
    return printError(err);
  }

  turbocolor.enabled = normalizedOpts.color;

  NodeReporter.showOptions(normalizedOpts);

  const spinner = ora("Looking for files...").start();
  const fileSearchTime = Date.now();

  let files;

  try {
    files = await globby(normalizedOpts.files, {
      ignore: normalizedOpts.ignore,
      absolute: true,
      gitignore: false, // FIXME revert to true after this is fixed: https://github.com/sindresorhus/globby/issues/133
    });
  } catch (err) {
    spinner.stop();
    return NodeReporter.fatalError(err.stack);
  }

  files = files.filter(f => !/\.(md|snap)$/.test(f));

  spinner.stop();

  if (files.length === 0) {
    return NodeReporter.fatalError("Zero files found.");
  }

  NodeReporter.showFilesCount(files.length, Date.now() - fileSearchTime);

  const Reporter = normalizedOpts.reporter;
  const runner = new NodeRunner(normalizedOpts, files);

  new Reporter(runner); // eslint-disable-line no-new

  runner.start();
}
