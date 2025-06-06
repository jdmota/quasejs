import { never } from "../../../../util/miscellaneous";
import { ChildProcessParent, WorkerParent } from "../../../../util/workers";
import { runner, _setup } from "./index";
import { RunnableOpts } from "./runnable-desc";
import type { RunnerEvents } from "./runner";
import type { GlobalRunnerOptions } from "./runner-pool";

export type FromParentToFork =
  | Readonly<{
      type: "setup";
      runnerOpts: RunnableOpts;
      tOpts: RunnableOpts;
    }>
  | Readonly<{
      type: "start";
      files: readonly string[];
    }>
  | Readonly<{ type: "sigint"; force: boolean; reason: string | null }>;

export type FromForkToParent = {
  [K in keyof RunnerEvents]: Readonly<{
    type: K;
    value: RunnerEvents[K][0];
  }>;
}[keyof RunnerEvents];

const workerConfig = process.env["$quase-unit$"] as
  | Exclude<GlobalRunnerOptions["worker"], "main">
  | undefined;

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
        setup(msg.runnerOpts, msg.tOpts);
        break;
      case "start":
        start(msg.files);
        break;
      case "sigint":
        sigint(msg.force, msg.reason);
        break;
      default:
        never(msg);
    }
  });

  process.on("SIGINT", () => {
    // Catch
  });
}

export function setup(runnerOpts: RunnableOpts, tOpts: RunnableOpts) {
  _setup(runnerOpts, tOpts);

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
    if (parent) {
      setTimeout(() => parent.disconnect());
    }
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
}

export function sigint(force: boolean, reason: string | null) {
  runner.sigint(force, reason);
}

export function terminate(signal?: NodeJS.Signals) {
  return true;
}

export function justForget() {}
