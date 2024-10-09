import EventEmitter from "node:events";
import { pathToFileURL } from "node:url";
import { getStack } from "../../../../error/src/index";
import {
  RunnableResult,
  RunnableTest,
  RunningContext,
  SET_SNAPSHOTS_OF_FILE,
} from "./runnable";
import { RunnableCtx, RunnableDesc } from "./runnable-desc";
import { prettify } from "../../../../util/path-url";
import { SimpleError } from "./errors";
import { SnapshotsOfFile } from "./snapshots";
import { type GlobalRunnerOptions } from "./runner-pool";

export type RunnerEvents = {
  started: [{ amount: number; total: number }];
  finished: [RunnableResult];
  testStart: [string];
  testFinish: [string];
  uncaughtError: [SimpleError];
};

export interface IRunner {
  readonly emitter: EventEmitter<RunnerEvents>;
  readonly runnerGlobalOpts: GlobalRunnerOptions;
  filesNumber(): number;
  executeTests(files: readonly string[]): void;
  sigint(force: boolean, reason: string | null): void;
  killForks(): Promise<void>;
}

// TODO config file
// TODO support custom serializable for snapshots? support something like Deno?
// TODO detect duplicate test titles?

export class Runner extends RunnableTest implements IRunner {
  readonly emitter: EventEmitter<RunnerEvents>;
  private files: readonly string[];

  constructor(
    readonly runnerCtx: RunnableCtx,
    readonly runnerGlobalOpts: GlobalRunnerOptions,
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

  private async fn(ctx: RunningContext) {
    const testsPerFile = [];

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

  filesNumber(): number {
    return this.files.length;
  }

  async executeTests(files: readonly string[]) {
    this.files = files;
    this.emitter.emit("started", { amount: 1, total: 1 });
    const result = await this.run();
    this.emitter.emit("finished", result);
  }

  uncaughtError(err: SimpleError) {
    this.emitter.emit("uncaughtError", err);
  }

  async killForks() {}
}
