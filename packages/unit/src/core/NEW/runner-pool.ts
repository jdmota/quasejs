import { resolve } from "path";
import EventEmitter from "events";
import { never } from "../../../../util/miscellaneous";
import {
  ChildProcessFork,
  WorkerFork,
  WorkerResult,
} from "../../../../util/workers";
import { sleep } from "../../../../util/async";
import { prettify } from "../../../../util/path-url";
import type { GlobalRunnerOptions, IRunner, RunnerEvents } from "./runner";
import type * as forkInterface from "./fork";
import type { FromForkToParent, FromParentToFork } from "./fork";
import { RunnableOpts } from "./runnable-desc";
import { RunnableResult } from "./runnable";
import { SimpleError, processError } from "./errors";

type RunnerFork = {
  id: number;
  files: readonly string[];
  interface: typeof forkInterface;
  started: boolean;
  finished: boolean;
  result: WorkerResult | null;
};

export enum TestsState {
  TESTS_NOT_STARTED, // Tests did not start
  TESTS_RUNNING, // Tests started but did not finish
  TESTS_FINISHED, // Tests finished
}

export enum ForkState {
  FORK_RUNNING,
  FORK_CLOSED,
  FORK_HANGING,
}

function checkState({ id, files, started, finished, result }: RunnerFork) {
  const aboutFork =
    result == null
      ? `Fork ${id} running.`
      : result.exit
        ? `Fork ${id} closed with ${result.errors.length} errors, exit code ${result.exit.code}, signal ${result.exit.signal}.`
        : `Fork ${id} left hanging with ${result.errors.length} errors registered.`;
  const aboutTests = !started
    ? "Tests did not start."
    : !finished
      ? "Tests started but did not finish."
      : "Tests finished.";
  return {
    ok:
      finished &&
      result?.errors.length === 0 &&
      result.exit?.code === 0 &&
      result.exit?.signal == null,
    message:
      aboutFork +
      "\n" +
      aboutTests +
      "\nFiles in this fork:\n" +
      files.map(f => "  " + prettify(f)).join("\n"),
  } as const;
}

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
    const workersNum = worker === "main" ? 1 : maxWorkers;

    const filesPerWorker: string[][] = [];
    for (let i = 0; i < workersNum; i++) {
      filesPerWorker.push([]);
    }

    let j = 0;
    for (const file of this.files) {
      filesPerWorker[j % workersNum].push(file);
      j++;
    }

    for (let i = 0; i < workersNum; i++) {
      const fork: RunnerFork = {
        id: i,
        files: filesPerWorker[i],
        interface: await this.createWorker(result => {
          fork.result = result;
        }),
        started: false,
        finished: false,
        result: null,
      };
      this.forks.push(fork);
    }

    let startedAmount = 0;
    let userErrors: SimpleError[] = [];
    let nonUserErrors: SimpleError[] = [];
    let logs = [];
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

            if (result.type === "passed" || result.type === "failed") {
              logs.push(...result.logs);
              children.push(...result.children);
              duration += result.duration;
              memoryUsage += result.memoryUsage ?? 0;
            } else {
              nonUserErrors.push(
                processError({
                  error: `Internal Error: Runner finished as ${result.type}?`,
                  stack: "",
                  user: false,
                  uncaught: true,
                })
              );
            }

            if (result.type === "failed") {
              passed = false;
              userErrors.push(...result.userErrors);
              nonUserErrors.push(...result.nonUserErrors);
            }

            if (children.length === this.forks.length) {
              const slow = this.runnerOpts.slow
                ? duration >= this.runnerOpts.slow
                : false;

              this.emitFinish(
                passed
                  ? {
                      title: "",
                      type: "passed",
                      logs,
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
                      userErrors,
                      nonUserErrors,
                      logs,
                      duration,
                      slow,
                      memoryUsage: memoryUsage || null,
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
            this.emitError(msg.value);
            break;
          case "matchesSnapshot":
            this.emitter.emit("matchesSnapshot", msg.value);
            break;
          default:
            never(msg);
        }
      });

      fork.interface.start(fork.files);
    }
  }

  private emitFinish(result: RunnableResult) {
    if (result.type === "failed") process.exitCode = 1;
    this.emitter.emit("finished", result);
  }

  private emitError(error: SimpleError) {
    process.exitCode = 1;
    this.emitter.emit("uncaughtError", error);
  }

  private createWorker(
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
      sigint(force: boolean) {
        fork.send({
          type: "sigint",
          force,
        });
      },
      terminate(signal?: NodeJS.Signals) {
        return fork.terminate(signal);
      },
      justForget() {
        fork.justForget();
      },
    });
  }

  sigint(force: boolean) {
    for (const fork of this.forks) {
      fork.interface.sigint(force);
    }
  }

  private calledKill = false;

  async killForks() {
    if (this.calledKill) return;
    this.calledKill = true;

    if (this.runnerGlobalOpts.worker === "main") {
      this.emitError({
        name: "Main thread error",
        message: "Main thread will forcefully close",
        stack: "",
        user: false,
        uncaught: true,
      });
      return;
    }

    let activeForks = this.forks.filter(f => f.result == null);
    let attempt = 1;
    while (activeForks.length > 0 && attempt <= 3) {
      activeForks.forEach(f => f.interface.terminate("SIGKILL"));
      await sleep(attempt * 250);
      activeForks = activeForks.filter(f => f.result == null);
      attempt++;
    }

    activeForks.forEach(f => f.interface.justForget());

    for (const fork of this.forks) {
      const { ok, message } = checkState(fork);
      if (!ok) {
        this.emitError({
          name: "Fork error",
          message,
          stack: "",
          user: false,
          uncaught: true,
        });
      }
    }
  }
}
