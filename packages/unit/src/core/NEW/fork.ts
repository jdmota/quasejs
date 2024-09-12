import { never } from "../../../../util/miscellaneous";
import { ChildProcessParent, WorkerParent } from "../../../../util/workers";
import { runner, _setup } from "./index";
import { RunnableOpts } from "./runnable-desc";
import { GlobalRunnerOptions, RunnerEvents } from "./runner";

export type FromParentToFork =
  | Readonly<{
      type: "setup";
      runnerOpts: RunnableOpts;
      runnerGlobalOpts: GlobalRunnerOptions;
      tOpts: RunnableOpts;
    }>
  | Readonly<{
      type: "start";
      files: readonly string[];
    }>
  | Readonly<{ type: "sigint"; force: boolean }>;

export type FromForkToParent = {
  [K in keyof RunnerEvents]: Readonly<{
    type: K;
    value: RunnerEvents[K][0];
  }>;
}[keyof RunnerEvents];

const workerConfig = process.env[
  "$quase-unit$"
] as GlobalRunnerOptions["worker"];

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
        setup(msg.runnerOpts, msg.runnerGlobalOpts, msg.tOpts);
        break;
      case "start":
        start(msg.files);
        break;
      case "sigint":
        sigint(msg.force);
        break;
      default:
        never(msg);
    }
  });

  process.on("SIGINT", () => {
    // Catch
  });
}

export function setup(
  runnerOpts: RunnableOpts,
  runnerGlobalOpts: GlobalRunnerOptions,
  tOpts: RunnableOpts
) {
  _setup(runnerOpts, runnerGlobalOpts, tOpts);

  if (parent) {
    listen(msg => {
      parent.send(msg);
    });
  }
}

export function start(files: readonly string[]) {
  runner.executeTests(files);
}

export function listen(callback: (message: FromForkToParent) => void) {
  runner.emitter.on("started", value => {
    callback({ type: "started", value });
  });

  runner.emitter.on("finished", value => {
    callback({ type: "finished", value });
    setTimeout(() => {
      parent?.disconnect();
    });
  });

  runner.emitter.on("testStart", value => {
    callback({ type: "testStart", value });
  });

  runner.emitter.on("testFinish", value => {
    callback({ type: "testFinish", value });
  });

  runner.emitter.on("testFinish", value => {
    callback({ type: "testFinish", value });
  });

  runner.emitter.on("uncaughtError", value => {
    callback({ type: "uncaughtError", value });
  });

  runner.emitter.on("matchesSnapshot", value => {
    callback({ type: "matchesSnapshot", value });
  });
}

export function sigint(force: boolean) {
  runner.sigint(force);
}

export function terminate(signal?: NodeJS.Signals) {
  return true;
}

export function justForget() {}
