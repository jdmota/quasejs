import { globby } from "globby";
import ora from "ora";
import turbocolor from "turbocolor";
import NodeReporter from "./reporters/node";
import { NodeRunner } from "./node-runner";
import { TestRunnerOptions } from "./types";

export default async function cli(options: TestRunnerOptions) {
  if (options.color != null) {
    turbocolor.enabled = options.color;
  }

  NodeReporter.showOptions(options);

  const spinner = ora("Looking for files...").start();
  const fileSearchTime = Date.now();

  let files;

  try {
    files = await globby(options.files, {
      ignoreFiles: options.ignore,
      absolute: true,
      gitignore: false, // FIXME revert to true after this is fixed: https://github.com/sindresorhus/globby/issues/133
    });
  } catch (err: any) {
    spinner.stop();
    return NodeReporter.fatalError(err.stack);
  }

  files = files.filter(f => !/\.(md|snap)$/.test(f));

  spinner.stop();

  if (files.length === 0) {
    return NodeReporter.fatalError("Zero files found.");
  }

  NodeReporter.showFilesCount(files.length, Date.now() - fileSearchTime);

  const runner = new NodeRunner(options, files);

  new NodeReporter(runner);

  runner.start();
}
