import { resolve } from "path";
import EventEmitter from "events";
import glob from "fast-glob";
import { never, type Optional } from "../../../../util/miscellaneous";
import {
  ChildProcessFork,
  WorkerFork,
  WorkerResult,
} from "../../../../util/workers";
import { sleep } from "../../../../util/async";
import { prettify } from "../../../../util/path-url";
import type { IRunner, RunnerEvents } from "./runner";
import type * as forkInterface from "./fork";
import type { FromForkToParent, FromParentToFork } from "./fork";
import { RunnableOpts } from "./runnable-desc";
import { RunnableResult } from "./runnable";
import { SimpleError, processError } from "./errors";
import { listenToDebugger } from "./debugger";
import * as mainFork from "./fork";
import { hasInspectArg } from "./utils";

// TODO config file
// TODO support custom serializable for snapshots? support something like Deno?
// TODO detect duplicate test titles?
// TODO html reporter

export type GlobalRunnerOptions = Readonly<{
  ["--"]: string[];
  files: readonly string[]; // @mergeStrategy("override") @description("Glob patterns of files to include");
  ignoreFiles: readonly string[]; // @mergeStrategy("concat") @description("Glob patterns of files to ignore");
  filterFiles: (f: string) => boolean;
  worker: "main" | "workers" | "processes";
  maxWorkers: number;
  globalTimeout?: number; // @default(20000) @description("Global timeout. Zero to disable. Disabled by default with --debug");
  verbose: boolean; // @description("Enable verbose output");
  errorOpts: Readonly<{
    diff: boolean;
    codeFrame: boolean;
    stack: boolean;
    stackIgnore: Optional<{
      test(text: string): boolean;
    }>;
  }>;
  debug?: boolean; // @description("Same as --inspect-wait on nodejs.");
  // TODO use below
  watch?: boolean; // @description("Watch files for changes and re-run the related tests");
  color?: boolean | null; // @default("auto") @description("Force or disable. Default: auto detection");
  env?: Record<string, unknown>; // @description("The test environment used for all tests. This can point to any file or node module");
  coverage?: boolean;
  concordanceOptions?: Record<string, unknown>; // @description("Concordance options");
  reporter?: any; // @description("Specify the reporter to use");
  //
  changedSince?: string | undefined;
  findRelatedTests?: string[];
  ci?: boolean;
}>;

type RunnerFork = {
  readonly id: number;
  readonly files: readonly string[];
  readonly interface: typeof forkInterface;
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
  private readonly execArgv: readonly string[];
  private readonly argv: readonly string[];
  private readonly debugging: boolean;
  private filesNumberNum = 0;

  constructor(
    readonly runnerOpts: RunnableOpts,
    readonly runnerGlobalOpts: GlobalRunnerOptions,
    readonly tOpts: RunnableOpts
  ) {
    this.emitter = new EventEmitter();
    this.forks = [];
    this.runnerOpts = { ...runnerOpts, signal: null }; // Nullify "signal" to avoid serialization errors
    const { ["--"]: moreArgs, debug } = this.runnerGlobalOpts;
    this.execArgv = [
      ...process.execArgv,
      ...(debug && !hasInspectArg(process.execArgv) ? ["--inspect-wait"] : []),
    ];
    // TODO can't debug worker_threads
    this.argv = [...moreArgs];
    this.debugging = hasInspectArg(this.execArgv);
  }

  workerType() {
    return this.runnerGlobalOpts.worker;
  }

  filesNumber() {
    return this.filesNumberNum;
  }

  async executeTests() {
    const {
      worker,
      maxWorkers,
      globalTimeout,
      files,
      ignoreFiles,
      filterFiles,
    } = this.runnerGlobalOpts;
    const workersNum = worker === "main" ? 1 : maxWorkers;

    if (globalTimeout) {
      setTimeout(() => {
        this.sigint(false, "Global timeout exceeded");
      }, globalTimeout);
    }

    const filesPerWorker: string[][] = [];
    for (let i = 0; i < workersNum; i++) {
      filesPerWorker.push([]);
    }

    let j = 0;
    for await (const _file of glob.stream([...files], {
      ignore: [...ignoreFiles],
      absolute: true,
    })) {
      const file = _file.toString();
      if (filterFiles(file)) {
        filesPerWorker[j % workersNum].push(file);
        j++;
      }
    }
    this.filesNumberNum = j; // For the reporter

    for (let i = 0; i < workersNum; i++) {
      const fork: RunnerFork = {
        id: i,
        files: filesPerWorker[i],
        interface: this.createWorker(filesPerWorker[i], result => {
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
      fork.interface.setup(this.runnerOpts, this.tOpts);

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

            if (this.forks.every(f => f.finished)) {
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
          case "debuggerListening":
            this.emitter.emit("debuggerListening", msg.value);
            break;
          case "debuggerWaitingDisconnect":
            this.emitter.emit("debuggerWaitingDisconnect", msg.value);
            break;
          default:
            never(msg);
        }
      });
    }

    for (const fork of this.forks) {
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
    files: readonly string[],
    onForkResult: (result: WorkerResult) => void
  ): typeof forkInterface {
    const {
      argv,
      execArgv,
      debugging,
      runnerGlobalOpts: { worker },
    } = this;

    if (worker === "main") {
      return mainFork;
    }

    let fork;
    if (worker === "workers") {
      fork = new WorkerFork<FromParentToFork, FromForkToParent>(
        resolve(import.meta.dirname, "./fork.ts"),
        argv,
        { ...process.env, "$quase-unit$": "workers" },
        execArgv
      );
    } else if (worker === "processes") {
      fork = new ChildProcessFork<FromParentToFork, FromForkToParent>(
        resolve(import.meta.dirname, "./fork.ts"),
        argv,
        { ...process.env, "$quase-unit$": "processes" },
        execArgv
      );
    } else {
      never(worker);
    }

    fork.once("result", onForkResult);
    return {
      setup(runnerOpts, tOpts) {
        fork.send({
          type: "setup",
          runnerOpts,
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
        if (debugging) {
          listenToDebugger(
            fork,
            socket =>
              callback({ type: "debuggerListening", value: { socket, files } }),
            socket =>
              callback({
                type: "debuggerWaitingDisconnect",
                value: { socket, files },
              }),
            () => {}
          );
        }
        fork.on("message", callback);
      },
      sigint(force: boolean, reason: string | null) {
        fork.send({
          type: "sigint",
          force,
          reason,
        });
      },
      terminate(signal?: NodeJS.Signals) {
        return fork.terminate(signal);
      },
      justForget() {
        fork.justForget();
      },
    };
  }

  sigint(force: boolean, reason: string | null) {
    for (const fork of this.forks) {
      fork.interface.sigint(force, reason);
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
