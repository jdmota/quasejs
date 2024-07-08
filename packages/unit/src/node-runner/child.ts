import path from "path";
import childProcess, { ForkOptions } from "child_process";
import { setExitCode } from "./util";
import { NodeRunner } from ".";
import {
  WhyIsRunning,
  ChildEvents,
  RunnerToChildEvents,
  TestRunnerOptions,
} from "../types";

export class RunnerProcess {
  private runner: NodeRunner;
  private notImportedFiles: Set<string>;
  private importedFiles: Set<string>;

  private started: boolean;
  private finished: boolean;
  private crashed: boolean;
  private whyIsRunning: WhyIsRunning | null;
  private notifiedWhy: boolean;

  private process: childProcess.ChildProcess;

  constructor(
    runner: NodeRunner,
    files: string[],
    options: TestRunnerOptions,
    args: string[],
    env: ForkOptions["env"],
    execArgv: ForkOptions["execArgv"]
  ) {
    this.runner = runner;

    this.notImportedFiles = new Set(files);
    this.importedFiles = new Set();

    this.started = false;
    this.finished = false;
    this.crashed = false;
    this.whyIsRunning = null;
    this.notifiedWhy = false;

    this.process = childProcess.fork(path.resolve(__dirname, "fork.js"), args, {
      cwd: process.cwd(),
      env,
      execArgv,
      silent: true,
    });

    this.process.send({
      type: "quase-unit-start",
      files,
      options,
    });

    this.process.on("error", error => {
      // @ts-ignore
      if (error.code !== "EPIPE") {
        throw error;
      }
    });

    this.process.on("message", msg =>
      this.runner.onChildEmit(this, msg as ChildEvents)
    );

    this.process.on("exit", (code: number, signal: string) => {
      if (!this.finished) {
        if (code !== 0) {
          setExitCode(1);
          this.crashed = true;
          const e = new Error(
            `Child process exited with code ${code} and signal ${signal}.`
          );
          runner.emit("otherError", e);
        }

        this.cleanup();
      }
    });
  }

  setStarted() {
    this.started = true;
  }

  setFinished() {
    this.finished = true;
  }

  setWhyIsRunning(why: WhyIsRunning) {
    this.whyIsRunning = why;
  }

  didStart() {
    return this.started;
  }

  didFinish() {
    return this.finished;
  }

  didCrash() {
    return this.crashed;
  }

  getNotImportedFiles() {
    return this.notImportedFiles;
  }

  fileImported(file: string) {
    this.notImportedFiles.delete(file);
    this.importedFiles.add(file);
  }

  ping() {
    if (!this.finished && !this.whyIsRunning) {
      this.send({
        type: "quase-unit-ping",
      });
    }
  }

  notifyWhyIsRunning() {
    if (!this.finished && !this.notifiedWhy && this.whyIsRunning) {
      this.notifiedWhy = true;
      this.runner.emit("why-is-running", this.whyIsRunning);
    }
  }

  send(msg: RunnerToChildEvents) {
    if (this.process.connected) {
      this.process.send(msg);
    }
  }

  get stdout() {
    return this.process.stdout;
  }

  get stderr() {
    return this.process.stderr;
  }

  cleanup() {
    if (!this.finished) {
      this.finished = true;
      this.process.removeAllListeners();
      this.runner.finishedFork();
    }
  }

  kill() {
    if (!this.finished) {
      this.cleanup();
      this.process.kill();
    }
  }
}
