import { resolve } from "path";
import EventEmitter from "events";
import { never } from "../../../../util/miscellaneous";
import {
  ChildProcessFork,
  WorkerFork,
  WorkerResult,
} from "../../../../util/workers";
import { GlobalRunnerOptions, IRunner, RunnerEvents } from "./runner";
import type * as forkInterface from "./fork";
import type { FromForkToParent, FromParentToFork } from "./fork";
import { RunnableOpts } from "./runnable-desc";

type RunnerFork = {
  interface: typeof forkInterface;
  started: boolean;
  finished: boolean;
  result: WorkerResult | null;
};

export class RunnerPool implements IRunner {
  readonly emitter: EventEmitter<RunnerEvents>;
  private readonly forks: RunnerFork[];

  constructor(
    readonly runnerOpts: RunnableOpts,
    readonly runnerGlobalOpts: GlobalRunnerOptions,
    readonly tOpts: RunnableOpts,
    readonly files: readonly string[]
  ) {
    this.emitter = new EventEmitter();
    this.forks = [];
    this.runnerOpts = { ...runnerOpts, signal: null }; // To avoid serialization errors
  }

  async executeTests() {
    const { worker, maxWorkers } = this.runnerGlobalOpts;
    if (worker === "main") {
      this.forks.push({
        interface: await this.createWorker(() => {}),
        started: false,
        finished: false,
        result: null,
      });
    } else {
      for (let i = 0; i < maxWorkers; i++) {
        const fork: RunnerFork = {
          interface: await this.createWorker(result => {
            fork.result = result;
          }),
          started: false,
          finished: false,
          result: null,
        };
        this.forks.push(fork);
      }
    }

    let startedAmount = 0;
    let children = [];
    let passed = true;
    let duration = 0;
    let memoryUsage = 0;

    for (const fork of this.forks) {
      fork.interface.setup(this.runnerOpts, this.runnerGlobalOpts, this.tOpts);

      fork.interface.listen(msg => {
        switch (msg.type) {
          case "started":
            startedAmount++;
            fork.started = true;
            this.emitter.emit("started", {
              amount: startedAmount,
              total: this.forks.length,
            });
            break;
          case "finished": {
            const result = msg.value;
            fork.finished = true;

            if (result.type === "failed") passed = false;

            if (this.forks.length === 1) {
              if (!passed) process.exitCode = 1;
              this.emitter.emit("finished", result);
              break;
            }

            children.push(result);
            duration +=
              result.type === "passed" || result.type === "failed"
                ? result.duration
                : 0;
            memoryUsage +=
              result.type === "passed" || result.type === "failed"
                ? result.memoryUsage ?? 0
                : 0;

            if (children.length === this.forks.length) {
              const slow = this.runnerOpts.slow
                ? duration >= this.runnerOpts.slow
                : false;

              if (!passed) process.exitCode = 1;

              // TODO
              this.emitter.emit(
                "finished",
                passed
                  ? {
                      title: "",
                      type: "passed",
                      logs: [],
                      duration,
                      slow,
                      memoryUsage: memoryUsage || null,
                      random: null,
                      children,
                      stack: "",
                      userMetadata: undefined,
                    }
                  : {
                      title: "",
                      type: "failed",
                      userErrors: [],
                      nonUserErrors: [],
                      logs: [],
                      duration,
                      slow,
                      memoryUsage,
                      random: null,
                      children,
                      stack: "",
                      userMetadata: undefined,
                    }
              );
            }
            break;
          }
          case "testStart":
            this.emitter.emit("testStart", msg.value);
            break;
          case "testFinish":
            this.emitter.emit("testFinish", msg.value);
            break;
          case "uncaughtError":
            this.emitter.emit("uncaughtError", msg.value);
            break;
          case "matchesSnapshot":
            this.emitter.emit("matchesSnapshot", msg.value);
            break;
          default:
            never(msg);
        }
      });

      fork.interface.start(this.files); // TODO distribute files
    }
  }

  createWorker(
    onForkResult: (result: WorkerResult) => void
  ): Promise<typeof forkInterface> {
    const workerType = this.runnerGlobalOpts.worker;
    if (workerType === "main") {
      return import("./fork");
    }
    let fork;
    if (workerType === "workers") {
      fork = new WorkerFork<FromParentToFork, FromForkToParent>(
        resolve(import.meta.dirname, "./fork.ts"),
        process.argv,
        { ...process.env, "$quase-unit$": "workers" },
        process.execArgv
      );
    } else if (workerType === "processes") {
      fork = new ChildProcessFork<FromParentToFork, FromForkToParent>(
        resolve(import.meta.dirname, "./fork.ts"),
        process.argv,
        { ...process.env, "$quase-unit$": "processes" },
        process.execArgv
      );
    } else {
      never(workerType);
    }
    fork.once("result", onForkResult);
    return Promise.resolve({
      setup(runnerOpts, runnerGlobalOpts, tOpts) {
        fork.send({
          type: "setup",
          runnerOpts,
          runnerGlobalOpts,
          tOpts,
        });
      },
      start(files) {
        fork.send({
          type: "start",
          files,
        });
      },
      listen(callback) {
        fork.on("message", callback);
      },
      terminate() {
        fork.terminate();
      },
    });
  }

  private checkState() {
    // TODO use
    const states = [];
    for (const fork of this.forks) {
      const aboutTests = !fork.started
        ? "Tests did not start."
        : !fork.finished
          ? "Tests started but did not finish."
          : "Tests finished.";
      const aboutFork = fork.result
        ? `Fork closed with ${fork.result.errors.length} errors and exit code ${fork.result.exit}.`
        : `Fork running.`;
      states.push({
        ok: fork.finished && fork.result != null,
        message: aboutTests + " " + aboutFork,
      });
    }
    return states;
  }

  private closeRoutine() {
    // TODO
    for (const fork of this.forks) {
      if (!fork.started) {
        this.emitter;
      }
    }
  }
}
