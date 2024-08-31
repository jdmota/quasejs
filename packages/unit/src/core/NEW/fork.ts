import { ChildProcessParent, WorkerParent } from "../../../../util/workers";
import { runner, _setup } from "./index";
import { RunnableResult } from "./runnable";
import { RunnableOpts } from "./runnable-desc";
import { GlobalRunnerOptions } from "./runner";

export type FromParentToFork =
  | {
      type: "setup";
    }
  | {
      type: "test-files";
    }
  | {
      type: "start";
    };

export type FromForkToParent = { type: "result"; result: RunnableResult };

const workerConfig = process.argv.includes("$quase-unit-workers$")
  ? "workers"
  : process.argv.includes("$quase-unit-processes$")
    ? "processes"
    : "main";

const parent =
  workerConfig === "workers"
    ? new WorkerParent<FromForkToParent, FromParentToFork>()
    : workerConfig === "processes"
      ? new ChildProcessParent<FromForkToParent, FromParentToFork>()
      : null;

if (parent) {
  parent.on("message", msg => {
    switch (msg.type) {
      case "setup":
        setup();
        break;
      case "test-files":
        testFiles();
        break;
      case "start":
        start();
        break;
    }
  });
}

export function setup(
  runnerOpts: RunnableOpts,
  runnerGlobalOpts: GlobalRunnerOptions,
  tOpts: RunnableOpts
) {
  _setup(runnerOpts, runnerGlobalOpts, tOpts);
}

export function testFiles() {
  // TODO import files
}

export function start() {
  runner.executeTests().then(result => {
    parent?.send({ type: "result", result });
  });
}
