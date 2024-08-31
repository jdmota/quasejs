import { resolve } from "path";
import EventEmitter from "events";
import { never } from "../../../../util/miscellaneous";
import { ChildProcessFork, WorkerFork } from "../../../../util/workers";
import { RunnableResult } from "./runnable";
import { GlobalRunnerOptions, IRunner, RunnerEvents } from "./runner";
import type * as forkInterface from "./fork";
import type { FromForkToParent, FromParentToFork } from "./fork";

export class RunnerPool implements IRunner {
  readonly emitter: EventEmitter<RunnerEvents>;

  constructor(readonly runnerOpts: GlobalRunnerOptions) {
    this.emitter = new EventEmitter();
  }

  executeTests(): Promise<RunnableResult> {
    throw new Error("Method not implemented.");
  }

  createWorker(): Promise<typeof forkInterface> {
    if (this.runnerOpts.worker === "main") {
      return import("./fork");
    }
    let fork;
    if (this.runnerOpts.worker === "workers") {
      fork = new WorkerFork<FromParentToFork, FromForkToParent>(
        resolve(import.meta.dirname, "./fork.ts"),
        ["$quase-unit-workers$"],
        {},
        process.execArgv
      );
    } else if (this.runnerOpts.worker === "processes") {
      fork = new ChildProcessFork<FromParentToFork, FromForkToParent>(
        resolve(import.meta.dirname, "./fork.ts"),
        ["$quase-unit-processes$"],
        {},
        process.execArgv
      );
    } else {
      never(this.runnerOpts.worker);
    }
    return Promise.resolve({
      setup() {
        fork.send({ type: "setup" });
      },
      testFiles() {
        fork.send({ type: "test-files" });
      },
      start() {
        fork.send({ type: "start" });
      },
    });
  }
}
