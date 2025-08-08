import EventEmitter from "node:events";
import { pathToFileURL } from "node:url";
import { getStack } from "../error/errors";
import {
  type RunnableResult,
  RunnableTest,
  type RunningContext,
  SET_SNAPSHOTS_OF_FILE,
} from "./runnable";
import { RunnableBuilder, RunnableDesc } from "./runnable-desc";
import { prettify } from "../util/path-url";
import { type SimpleError } from "./errors";
import { SnapshotsOfFile } from "./snapshots";
import { hasInspectArg } from "./utils";

export type RunnerEvents = {
  started: [{ amount: number; total: number }];
  finished: [RunnableResult];
  testStart: [string];
  testFinish: [string];
  uncaughtError: [SimpleError];
  debuggerListening: [{ socket: string; files: readonly string[] }];
  debuggerWaitingDisconnect: [{ socket: string; files: readonly string[] }];
};

export interface IRunner {
  readonly emitter: EventEmitter<RunnerEvents>;
  workerType(): "main" | "workers" | "processes";
  filesNumber(): number;
  executeTests(files: readonly string[]): void;
  sigint(force: boolean, reason: string | null): void;
  killForks(): Promise<void>;
}

export class Runner extends RunnableTest implements IRunner {
  readonly emitter: EventEmitter<RunnerEvents>;
  private files: readonly string[];

  constructor(
    readonly runnerCtx: RunnableBuilder,
    readonly runnerTests: { ref: RunnableDesc[] | null }
  ) {
    super(
      null,
      new RunnableDesc("", ctx => this.fn(ctx), runnerCtx.opts, getStack(2)),
      null
    );
    this.emitter = new EventEmitter();
    this.files = [];
  }

  async executeTests(files: readonly string[]) {
    this.files = files;
    this.emitter.emit("started", { amount: 1, total: 1 });
    const result = await this.run();
    this.emitter.emit("finished", result);
  }

  private async fn(ctx: RunningContext) {
    const testsPerFile = [];

    if (hasInspectArg(process.execArgv)) {
      // The debugger breaks here before running the test files
      // Click "next" in the debugger when you are ready!
      debugger;
    }

    for (const file of this.files) {
      const tests: RunnableDesc[] = (this.runnerTests.ref = []);
      await import(pathToFileURL(file).href);
      this.runnerTests.ref = null;
      testsPerFile.push([file, tests] as const);
    }

    for (const [file, tests] of testsPerFile) {
      await ctx.step(
        new RunnableDesc(
          prettify(file),
          async ctx => {
            // Init snapshot tester
            const snap = await SnapshotsOfFile.decode(file);
            ctx[SET_SNAPSHOTS_OF_FILE](snap);

            // Cleanup and save snapshot
            ctx.cleanup(async () => {
              const { warnings } = await snap.save();
              for (const w of warnings) {
                ctx.log(`Snapshot warning: ${w}`);
              }
              // TODO make this an error?
            });

            // Random option will be applied to each group (i.e. file),
            // giving consistent results!
            await ctx.group(tests);
          },
          this.desc.opts,
          `Error\n    at <anonymous> (${file}:1:1)`
        )
      );
    }
  }

  workerType() {
    return "main" as const;
  }

  filesNumber() {
    return this.files.length;
  }

  uncaughtError(err: SimpleError) {
    this.emitter.emit("uncaughtError", err);
  }

  async killForks() {}
}
