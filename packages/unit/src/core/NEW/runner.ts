import EventEmitter from "node:events";
import { nonNull, Optional } from "../../../../util/miscellaneous";
import { RunnableTest, RunningContext, SimpleError } from "./runnable";
import { RunnableCtx, RunnableDesc } from "./runnable-desc";
import { Defer } from "../../../../util/deferred";

export type GlobalRunnerOptions = Readonly<{
  ["--"]: string[];
  files: readonly string[]; // @mergeStrategy("override") @description("Glob patterns of files to include");
  ignoreFiles: readonly string[]; // @mergeStrategy("concat") @description("Glob patterns of files to ignore");
  filterFiles: (f: string) => boolean;
  concurrentFiles: number;
  worker: "main" | "workers" | "processes";
  watch: boolean; // @description("Watch files for changes and re-run the related tests");
  color: boolean | null; // @default("auto") @description("Force or disable. Default: auto detection");
  env: Record<string, unknown>; // @description("The test environment used for all tests. This can point to any file or node module");
  globalTimeout: number; // @default(20000) @description("Global timeout. Zero to disable. Disabled by default with --debug");
  coverage: boolean;
  verbose: boolean; // @description("Enable verbose output");
  debug: boolean; // @description("Same as --inspect-brk on nodejs.");
  concordanceOptions: Record<string, unknown>; // @description("Concordance options");
  reporter: any; // @description("Specify the reporter to use");
  //
  changedSince: string | undefined;
  findRelatedTests: string[];
  ci: boolean;
  //
  errorOpts: Readonly<{
    diff: boolean;
    codeFrame: boolean;
    stack: boolean;
    stackIgnore: Optional<string | RegExp>;
  }>;
}>;

export type RunnerEvents = {
  uncaughtError: [SimpleError];
  matchesSnapshot: [any];
};

export class Runner extends RunnableTest {
  readonly emitter: EventEmitter<RunnerEvents>;

  constructor(
    readonly runnerCtx: RunnableCtx,
    readonly runnerOpts: GlobalRunnerOptions,
    readonly runnerTests: { ref: RunnableDesc[] | null }
  ) {
    super(new RunnableDesc("", ctx => this.fn(ctx), runnerCtx.opts, ""), null);
    this.emitter = new EventEmitter();
  }

  private async fn(ctx: RunningContext) {
    const tests = nonNull(this.runnerTests.ref);
    this.runnerTests.ref = null;
    await ctx.group(tests);
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
