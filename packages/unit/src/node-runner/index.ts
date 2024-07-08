import { EventEmitter } from "events";
import { RunnerProcess } from "./child";
import {
  RunStart,
  RunEnd,
  ChildEvents,
  ChildEventsEmit,
  TestRunnerOptions,
} from "../types";
import { setExitCode } from "./util";
import { SourceMapExtractor } from "../../../source-map/src";
import { beautify } from "../../../error/src";

const CircularJSON = require("circular-json");

const reDebugger = /Debugger listening on (ws:\/\/.+)\r?\n/;
const reDebuggerWaiting = /Waiting for the debugger to disconnect/;

function getDebugger(child: RunnerProcess) {
  return new Promise<string>((resolve, reject) => {
    function error() {
      reject(new Error("Waited for debugger for too long"));
    }

    const timeoutId = setTimeout(error, 10000);
    let str = "";

    function cb(data: string) {
      str += data;
      const m = str.match(reDebugger);
      if (m) {
        if (child.stderr) {
          child.stderr.removeListener("data", cb);
        }
        clearTimeout(timeoutId);
        resolve(m[1]);
      }
    }

    if (child.stderr) {
      child.stderr.on("data", cb);
    }
  });
}

function getDebuggerWaiting(child: RunnerProcess) {
  return new Promise<void>(resolve => {
    let str = "";
    function cb(data: string) {
      str += data;
      if (reDebuggerWaiting.test(str)) {
        if (child.stderr) {
          child.stderr.removeListener("data", cb);
        }
        resolve();
      }
    }
    if (child.stderr) {
      child.stderr.on("data", cb);
    }
  });
}

function concat<T>(original: T[], array: T[]) {
  for (let i = 0; i < array.length; i++) {
    original.push(array[i]);
  }
  return original;
}

export class NodeRunner extends EventEmitter {
  readonly options: TestRunnerOptions;
  readonly files: string[];
  division: string[][];
  readonly forks: RunnerProcess[];
  readonly debuggersPromises: Promise<string>[];
  readonly debuggersWaitingPromises: Promise<void>[];
  private timeStart: number | undefined;
  private runStarts: number;
  private runEnds: number;
  private runStartEmmited: boolean;
  private runEndEmmited: boolean;
  private buffer: ChildEventsEmit[];
  private failedOnce: boolean;
  private runStartArg: RunStart;
  private runEndArg: RunEnd;
  private extractor: SourceMapExtractor;
  private globalTimeoutId: NodeJS.Timeout | undefined;
  private detectFinishedTimeout: NodeJS.Timeout | undefined;
  private finishedForks: number;
  private sentSigint: number;
  private onSigint: () => void;

  constructor(options: TestRunnerOptions, files: string[]) {
    super();
    this.options = options;
    this.files = files;
    this.division = [];
    this.forks = [];
    this.debuggersPromises = [];
    this.debuggersWaitingPromises = [];
    this.timeStart = undefined;

    this.runStarts = 0;
    this.runEnds = 0;
    this.runStartEmmited = false;
    this.runEndEmmited = false;
    this.buffer = [];
    this.failedOnce = false;

    this.runStartArg = {
      type: "runStart",
      name: "",
      fullname: [],
      tests: [], // Fill
      childSuites: [], // Fill
      testCounts: {
        passed: undefined,
        failed: undefined,
        skipped: undefined,
        todo: undefined,
        total: 0, // Increment
      },
    };
    this.runEndArg = {
      type: "runEnd",
      name: "",
      fullname: [],
      tests: [], // Fill
      childSuites: [], // Fill
      status: "passed", // Set
      runtime: 0, // Set
      testCounts: {
        passed: 0, // Increment
        failed: 0, // Increment
        skipped: 0, // Increment
        todo: 0, // Increment
        total: 0, // Increment
      },
      snapshotStats: {
        added: 0, // Increment
        updated: 0, // Increment
        removed: 0, // Increment
        obsolete: 0, // Increment
      },
      onlyCount: 0, // Increment
      pendingTests: new Set(), // Fill
      notStartedForks: [], // Fill
      interrupted: false, // Set
      whyIsRunning: [], // Fill
    };

    this.extractor = new SourceMapExtractor();

    this.globalTimeoutId = undefined;
    this.detectFinishedTimeout = undefined;
    this.finishedForks = 0;

    this.sentSigint = 0;
    this.onSigint = () => {
      setExitCode(1);

      this.sentSigint++;
      if (this.runEndEmmited || this.sentSigint > 2) {
        process.removeListener("SIGINT", this.onSigint);
        this.killAllForks();
      } else {
        this.emit("sigint", this.sentSigint);

        for (const fork of this.forks) {
          fork.send({
            type: "quase-unit-sigint",
          });
        }
      }
    };
  }

  finishedFork() {
    this.finishedForks++;
    if (this.finishedForks === this.forks.length) {
      if (this.detectFinishedTimeout != null) {
        clearTimeout(this.detectFinishedTimeout);
      }
      if (this.globalTimeoutId != null) {
        clearTimeout(this.globalTimeoutId);
      }
      process.nextTick(() => this.runEnd());
    }
  }

  forksRunning() {
    let running = 0;
    for (const fork of this.forks) {
      if (!fork.didFinish()) {
        running++;
      }
    }
    return running;
  }

  killAllForks() {
    setExitCode(1);
    for (const fork of this.forks) {
      fork.notifyWhyIsRunning();
      fork.kill();
    }
  }

  // This might be called in two situations:
  // - All forks sent "runEnd" (that does not mean that they finished)
  // - All forks have finished
  runEnd() {
    if (this.runEndEmmited) {
      return;
    }
    this.runEndEmmited = true;

    const { notStartedForks, pendingTests } = this.runEndArg;

    for (const fork of this.forks) {
      if (!fork.didStart()) {
        notStartedForks.push({
          didCrash: fork.didCrash(),
          notImportedFiles: fork.getNotImportedFiles(),
        });
      }
    }

    this.runEndArg.interrupted = !!this.sentSigint;

    if (this.runEndArg.testCounts.total === this.runEndArg.testCounts.skipped) {
      this.runEndArg.status = "skipped";
    } else if (
      this.runEndArg.testCounts.total === this.runEndArg.testCounts.todo
    ) {
      this.runEndArg.status = "todo";
    } else if (this.runEndArg.testCounts.failed) {
      this.runEndArg.status = "failed";
    } else {
      this.runEndArg.status = "passed";
    }

    if (
      notStartedForks.length > 0 ||
      this.runEndArg.interrupted ||
      pendingTests.size > 0
    ) {
      setExitCode(1);
    }

    const { failed, total } = this.runEndArg.testCounts;
    setExitCode(failed || !total ? 1 : 0);

    this.emit("runEnd", this.runEndArg);

    if (this.forksRunning()) {
      this.detectFinishedTimeout = setTimeout(() => {
        for (const fork of this.forks) {
          fork.notifyWhyIsRunning();
        }
      }, 2000);
    }
  }

  testFailure() {
    if (this.failedOnce) {
      return;
    }
    this.failedOnce = true;

    if (this.options.bail) {
      for (const fork of this.forks) {
        fork.send({
          type: "quase-unit-bail",
        });
      }
    }
  }

  onChildEmit(forkProcess: RunnerProcess, msg: ChildEvents) {
    if (msg.type === "quase-unit-emit") {
      const eventType = msg.eventType;
      const arg = CircularJSON.parse(msg.arg);

      if (eventType === "runStart") {
        forkProcess.setStarted();

        concat(this.runStartArg.tests, arg.tests);
        concat(this.runStartArg.childSuites, arg.childSuites);
        this.runStartArg.testCounts.total += arg.testCounts.total;

        if (++this.runStarts === this.forks.length) {
          this.timeStart = Date.now();

          this.emit(eventType, this.runStartArg);
          this.runStartEmmited = true;

          const buffer = this.buffer;
          this.buffer = [];

          for (const { eventType, arg } of buffer) {
            this.emit(eventType, arg);
          }
        }
      } else if (eventType === "runEnd") {
        concat(this.runEndArg.tests, arg.tests);
        concat(this.runEndArg.childSuites, arg.childSuites);

        this.runEndArg.testCounts.passed += arg.testCounts.passed;
        this.runEndArg.testCounts.failed += arg.testCounts.failed;
        this.runEndArg.testCounts.skipped += arg.testCounts.skipped;
        this.runEndArg.testCounts.todo += arg.testCounts.todo;
        this.runEndArg.testCounts.total += arg.testCounts.total;

        this.runEndArg.snapshotStats.added += arg.snapshotStats.added;
        this.runEndArg.snapshotStats.updated += arg.snapshotStats.updated;
        this.runEndArg.snapshotStats.removed += arg.snapshotStats.removed;
        this.runEndArg.snapshotStats.obsolete += arg.snapshotStats.obsolete;

        this.runEndArg.onlyCount += arg.onlyCount;

        forkProcess.setWhyIsRunning(arg.whyIsRunning);

        if (++this.runEnds === this.forks.length) {
          if (this.timeStart) {
            this.runEndArg.runtime = Date.now() - this.timeStart;
          }
          this.runEnd();
        }
      } else if (eventType === "otherError") {
        setExitCode(1);

        this.emit(eventType, arg);
        if (!forkProcess.didStart()) {
          forkProcess.kill();
        }
      } else {
        if (eventType === "testStart") {
          this.runEndArg.pendingTests.add(arg.defaultStack);
        } else if (eventType === "testEnd") {
          this.runEndArg.pendingTests.delete(arg.defaultStack);

          if (arg.status === "failed") {
            this.testFailure();
          }
        }

        if (this.runStartEmmited) {
          this.emit(eventType, arg);
        } else {
          this.buffer.push({
            type: "quase-unit-emit",
            eventType,
            arg,
          });
        }
      }
    } else if (msg.type === "quase-unit-source") {
      this.beautifyStack(msg.stack).then(({ source }) => {
        if (!source) {
          throw new Error("Assertion error");
        }
        forkProcess.send({
          type: "quase-unit-source",
          id: msg.id,
          source,
        });
      });
    } else if (msg.type === "quase-unit-why-is-running") {
      forkProcess.setWhyIsRunning(msg.whyIsRunning);
    } else if (msg.type === "quase-unit-file-imported") {
      forkProcess.fileImported(msg.file);
    }
  }

  async beautifyStack(stack: string) {
    return beautify(stack, {
      extractor: this.extractor,
      ignore: this.options.stackIgnore,
    });
  }

  async divide() {
    const num = this.options.concurrency;
    const final: string[][] = [];
    const map = new Map<string, Set<string>>(); // Map<original, Set<generated>>
    // The snapshot managers are in the fork process
    // and we try to point to the original sources.
    // If a original is used more than once, we have to join
    // the respective generated files in the same fork.
    // Since this is very rare, we just put all these
    // in the same fork (even if some share nothing).
    const weirdFiles: Set<string> = new Set();

    await Promise.all(
      this.files.map(async file => {
        for (const src of await this.extractor.getOriginalSources(file)) {
          const set = map.get(src) ?? new Set();
          set.add(file);
          map.set(src, set);
        }
      })
    );

    for (let i = 0; i < num; i++) {
      final.push([]);
    }

    for (const set of map.values()) {
      if (set.size > 1) {
        for (const f of set) {
          weirdFiles.add(f);
        }
      }
    }

    if (weirdFiles.size) {
      for (let i = 0; i < this.files.length; i++) {
        const file = this.files[i];
        if (weirdFiles.has(file)) {
          final[0].push(file);
        } else {
          final[(i % (num - 1)) + 1].push(file);
        }
      }
    } else {
      for (let i = 0; i < this.files.length; i++) {
        const file = this.files[i];
        final[i % num].push(file);
      }
    }

    return final;
  }

  async start() {
    const options = this.options;
    const division = (this.division = await this.divide());

    const env = Object.assign({ NODE_ENV: "test" }, process.env, options.env);
    const execArgv = [];
    const args = [];
    let debugging = false;

    if (options.logHeapUsage) {
      args.push("--expose-gc");
    }

    for (const arg of options["--"]) {
      args.push(arg);
    }

    if (options.debug) {
      execArgv.push("--inspect-brk");
      debugging = true;
    }

    for (let i = 0; i < division.length; i++) {
      if (division[i].length) {
        const fork = new RunnerProcess(
          this,
          division[i],
          options,
          args,
          env,
          execArgv
        );
        this.forks.push(fork);
        if (debugging) {
          this.debuggersPromises.push(getDebugger(fork));
          this.debuggersWaitingPromises.push(getDebuggerWaiting(fork));
        }
      }
    }

    process.on("SIGINT", this.onSigint);

    process.once("beforeExit", async () => {
      this.emit("exit", {});
    });

    if (this.options.globalTimeout) {
      this.globalTimeoutId = setTimeout(() => {
        this.emit("global-timeout");

        for (const fork of this.forks) {
          fork.ping();
        }

        setTimeout(() => this.killAllForks(), 1000);
      }, this.options.globalTimeout);
    }

    this.emit("start");
    return this;
  }
}
