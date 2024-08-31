import EventEmitter from "node:events";
import { nonNull, Optional } from "../../../../util/miscellaneous";
import { getStack } from "../../../../error/src/index";
import {
  RunnableResult,
  RunnableTest,
  RunningContext,
  SimpleError,
} from "./runnable";
import { RunnableCtx, RunnableDesc } from "./runnable-desc";
import { Defer } from "../../../../util/deferred";

export type GlobalRunnerOptions = Readonly<{
  ["--"]?: string[];
  files: readonly string[]; // @mergeStrategy("override") @description("Glob patterns of files to include");
  ignoreFiles?: readonly string[]; // @mergeStrategy("concat") @description("Glob patterns of files to ignore");
  filterFiles?: (f: string) => boolean;
  worker: "main" | "workers" | "processes";
  maxWorkers: number;
  watch?: boolean; // @description("Watch files for changes and re-run the related tests");
  color?: boolean | null; // @default("auto") @description("Force or disable. Default: auto detection");
  env?: Record<string, unknown>; // @description("The test environment used for all tests. This can point to any file or node module");
  globalTimeout?: number; // @default(20000) @description("Global timeout. Zero to disable. Disabled by default with --debug");
  coverage?: boolean;
  verbose: boolean; // @description("Enable verbose output");
  debug?: boolean; // @description("Same as --inspect-brk on nodejs.");
  concordanceOptions?: Record<string, unknown>; // @description("Concordance options");
  reporter?: any; // @description("Specify the reporter to use");
  //
  changedSince?: string | undefined;
  findRelatedTests?: string[];
  ci?: boolean;
  //
  errorOpts: Readonly<{
    diff: boolean;
    codeFrame: boolean;
    stack: boolean;
    stackIgnore: Optional<{
      test(text: string): boolean;
    }>;
  }>;
}>;

export type RunnerEvents = {
  started: [{ amount: number; total: number }];
  finished: [RunnableResult];
  testStart: [string];
  testFinish: [string];
  uncaughtError: [SimpleError];
  matchesSnapshot: [any];
};

export interface IRunner {
  readonly emitter: EventEmitter<RunnerEvents>;
  readonly runnerGlobalOpts: GlobalRunnerOptions;
  executeTests(files: readonly string[]): void;
}

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
      new RunnableDesc("", ctx => this.fn(ctx), runnerCtx.opts, getStack(1)),
      null
    );
    this.emitter = new EventEmitter();
    this.files = [];
  }

  private async fn(ctx: RunningContext) {
    for (const file of this.files) {
      await import(file);
    }
    const tests = nonNull(this.runnerTests.ref);
    this.runnerTests.ref = null;
    await ctx.group(tests);
  }

  async executeTests(files: readonly string[]) {
    this.files = files;
    this.emitter.emit("started", { amount: 1, total: 1 });
    const result = await this.run();
    if (result.type === "failed") process.exitCode = 1;
    this.emitter.emit("finished", result);
  }

  uncaughtError(err: SimpleError) {
    this.emitter.emit("uncaughtError", err);
  }

  matchesSnapshot(
    something: unknown,
    stack: string,
    key: string,
    deferred: Defer<void>
  ) {
    this.emitter.emit("matchesSnapshot", {
      something,
      stack,
      key,
      deferred,
    });
  }
}
