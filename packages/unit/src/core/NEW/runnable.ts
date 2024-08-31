import { inspect } from "node:util";
import concordance from "concordance";
import { getStack } from "../../../../error/src/index";
import { createDefer, Defer } from "../../../../util/deferred";
import { assertion, Optional } from "../../../../util/miscellaneous";
import { GlobalsSanitizer } from "./sanitizers/globals-sanitizer";
import { defaultOpts, RunnableDesc } from "./runnable-desc";
import { Randomizer, randomizer } from "./random";
import { Runner } from "./runner";
import { concordanceOptions } from "./concordance-options";
import { runWithCtx } from "./sanitizers/context-tracker";
import { enableUncaughtErrorsTracker } from "./sanitizers/uncaught-errors";
import {
  enableHandlesTracker,
  getActiveHandles,
} from "./sanitizers/handles-sanitizer";
import { enableExitsTracker } from "./sanitizers/process-sanitizer";
import { enableWarningsTracker } from "./sanitizers/warnings-sanitizer";

export type ErrorOpts = Readonly<{
  error: unknown;
  stack: string;
  user: boolean;
  uncaught?: boolean;
}>;

export type SimpleError = Readonly<{
  name: string;
  message: string;
  stack: string;
  diff?: string;
  user: boolean;
  uncaught: boolean;
}>;

export function processError(opts: ErrorOpts): SimpleError {
  const { error, stack, user, uncaught } = opts;
  if (error != null && typeof error === "object") {
    let diff = undefined;
    if ("actual" in error && "expected" in error) {
      diff = concordance.diff(error.actual, error.expected, concordanceOptions);
    }
    const err = error as Record<string, unknown>;
    return {
      name: (err.name ?? "Error") + "",
      message: (err.message ?? "") + "",
      stack: (err.stack ?? stack) + "",
      diff,
      user,
      uncaught: uncaught ?? false,
    };
  }
  if (typeof error === "string") {
    return {
      name: "Error",
      message: error,
      stack,
      user,
      uncaught: uncaught ?? false,
    };
  }
  return {
    name: "UnknownError",
    message: error + "",
    stack,
    user,
    uncaught: uncaught ?? false,
  };
}

export type RunnableResult =
  | Readonly<{
      title: string;
      type: "passed";
      logs: readonly string[];
      duration: number;
      slow: boolean;
      memoryUsage: number | null;
      random: string | null;
      children?: readonly RunnableResult[];
      stack: string;
    }>
  | Readonly<{
      title: string;
      type: "failed";
      userErrors: readonly SimpleError[];
      nonUserErrors: readonly SimpleError[];
      logs: readonly string[];
      duration: number;
      slow: boolean;
      memoryUsage: number | null;
      random: string | null;
      children?: readonly RunnableResult[];
      stack: string;
    }>
  | Readonly<{
      title: string;
      type: "skipped";
      reason: Optional<string>;
      stack: string;
    }>
  | Readonly<{
      title: string;
      type: "todo";
      description: Optional<string>;
      stack: string;
    }>
  | Readonly<{
      title: string;
      type: "hidden";
      stack: string;
    }>;

export type RunnableStatus = RunnableResult["type"];

export const HIDDEN = { type: "hidden" } as const;

export const SKIP_BAILED = {
  type: "skipped",
  reason: "Bailed",
} as const;

export const SKIP_INTERRUPTED = {
  type: "skipped",
  reason: "Interrupted",
} as const;

export const SKIP_ABORTED = {
  type: "skipped",
  reason: "Aborted",
} as const;

export interface RunningContext {
  step(desc: RunnableDesc): RunnableResult | Promise<RunnableResult>;
  group(descs: readonly RunnableDesc[]): Promise<readonly RunnableResult[]>;
  cleanup(fn: () => void | Promise<void>): void;
  incAssertionCount(): void;
  addError(error: unknown): void;
  log(...args: unknown[]): void;
  matchesSnapshot(something: unknown, key?: string): void;
}

export enum RunnableState {
  NotStarted,
  Running,
  Cleanup,
  Exiting,
  Finished,
}

export class RunnableTest {
  private state: RunnableState;
  private finished: RunnableResult | null;
  private interrupted: string | null;
  private killed: boolean;
  private childFails: number;
  private bailed: boolean;
  private readonly tests: RunnableTest[];
  private readonly userErrors: SimpleError[];
  private readonly nonUserErrors: SimpleError[];
  private readonly logs: string[];
  private assertionCount: number;
  private timeoutId: NodeJS.Timeout | number | null;
  private deferred1: Defer<void> | null;
  private deferred2: Defer<void> | null;
  private timeStart: number;
  private globals: GlobalsSanitizer | null;
  private random: Randomizer | null;
  private cleanups: (() => void | Promise<void>)[];
  private cleanAbort: (() => void) | null;

  constructor(
    readonly runner: Runner | null,
    readonly desc: RunnableDesc,
    readonly parent: RunnableTest | null
  ) {
    this.state = RunnableState.NotStarted;
    this.finished = null;
    this.interrupted = null;
    this.killed = false;
    this.childFails = 0;
    this.bailed = false;
    this.tests = [];
    this.userErrors = [];
    this.nonUserErrors = [];
    this.logs = [];
    this.assertionCount = 0;
    this.timeoutId = null;
    this.deferred1 = null;
    this.deferred2 = null;
    this.timeStart = 0;
    this.globals = null;
    this.random = randomizer(this.desc.opts.random);
    this.cleanups = [];
    this.cleanAbort = null;
  }

  getOptions() {
    return this.desc.opts;
  }

  private addCleanup(fn: () => void | Promise<void>) {
    if (this.state === RunnableState.Running) {
      this.cleanups.push(fn);
    } else {
      this.addCtxError("Calling cleanup after the test has finished");
    }
  }

  private incAssertionCount() {
    if (this.state === RunnableState.Running) {
      this.assertionCount++;
    } else {
      this.addCtxError("Calling incAssertionCount after the test has finished");
    }
  }

  private addLog(args: readonly unknown[]) {
    if (this.state === RunnableState.Running) {
      this.logs.push(args.map(a => inspect(a)).join(" "));
    } else {
      this.addCtxError("Calling log after the test has finished");
    }
  }

  private addCtxError(error: string) {
    this.addError({
      error,
      stack: getStack(2),
      user: false,
    });
  }

  private addExitError(error: string) {
    this.addError({
      error,
      stack: this.desc.stack,
      user: false,
    });
  }

  private addSimpleError(err: SimpleError) {
    if (this.finished) {
      if (this.parent) {
        this.parent.addSimpleError({ ...err, uncaught: true });
      } else if (this instanceof Runner) {
        this.uncaughtError({ ...err, uncaught: true });
      } else {
        assertion(false);
      }
    } else {
      const arr = err.user ? this.userErrors : this.nonUserErrors;
      arr.push(err);
    }
  }

  addError(opts: ErrorOpts) {
    this.addSimpleError(processError(opts));
  }

  private async group(
    descs: readonly RunnableDesc[]
  ): Promise<readonly RunnableResult[]> {
    if (this.state !== RunnableState.Running) {
      this.addCtxError("Cannot run child tests of a finished test");
      return [];
    }

    const concurrency = this.desc.opts.concurrency;
    const groupSize = Math.ceil(descs.length / concurrency) || 1;
    const groups = [];
    descs = this.random ? this.random.shuffle(descs) : descs;

    let group = [];
    for (let i = 0; i < descs.length; i++) {
      group.push(descs[i]);
      if (group.length === groupSize) {
        groups.push(group);
        group = [];
      }
    }

    if (group.length > 0) {
      groups.push(group);
    }

    const results = await Promise.all(groups.map(g => this.runGroup(g)));
    return results.flat();
  }

  private async runGroup(descs: readonly RunnableDesc[]) {
    const results = [];
    for (const desc of descs) {
      results.push(await this.step(desc));
    }
    return results;
  }

  private step(desc: RunnableDesc): RunnableResult | Promise<RunnableResult> {
    if (this.state === RunnableState.Running) {
      const runnable = new RunnableTest(this.runner, desc, this);
      this.tests.push(runnable);
      if (this.interrupted) {
        runnable.interrupt(`From parent: ${this.interrupted}`, false);
      }
      return runnable.run();
    }
    this.addCtxError("Cannot run a child test of a finished test");
    return {
      title: desc.title,
      type: "hidden",
      stack: desc.stack,
    };
  }

  // Called by child tests
  private childFailed() {
    this.childFails++;
    if (!this.bailed && this.childFails === this.desc.opts.bail) {
      this.bailed = true;
      this.tests.forEach(t => t.interrupt(SKIP_BAILED.reason, false));
    }
  }

  // Called by self or parent test
  interrupt(errorMsg: string, kill: boolean) {
    if (
      this.state === RunnableState.Exiting ||
      this.state === RunnableState.Finished
    )
      return;
    if (this.killed) return;
    if (!kill && this.interrupted) return;

    if (this.state === RunnableState.NotStarted) {
      this.interrupted = errorMsg;
      this.finish({
        title: this.desc.title,
        type: "skipped",
        reason: errorMsg,
        stack: this.desc.stack,
      });
    } else if (this.state === RunnableState.Running) {
      this.interrupted = errorMsg;
      this.deferred1?.resolve();
      this.tests.forEach(t => t.interrupt(`From parent: ${errorMsg}`, kill));
    } else if (kill) {
      // this.state === RunnableTestState.Cleanup
      this.interrupted = errorMsg;
      this.deferred2?.resolve();
      this.tests.forEach(t => t.interrupt(`From parent: ${errorMsg}`, kill));
    }

    if (kill) {
      this.killed = true;
    }
  }

  // Called by parent test
  kill() {
    this.interrupt("Forced shutdown", true);
  }

  private job: Promise<RunnableResult> | null = null;

  run(): RunnableResult | Promise<RunnableResult> {
    if (this.finished) return this.finished;
    if (this.job) return this.job;
    const run = this.exec();
    return run instanceof Promise ? (this.job = run) : run;
  }

  private finish(r: RunnableResult) {
    this.state = RunnableState.Finished;
    this.finished = r;
    this.runner?.emitter.emit("testFinish", this.desc.title);
    if (r.type === "failed") {
      this.parent?.childFailed();
    }
    return r;
  }

  private exec(): RunnableResult | Promise<RunnableResult> {
    const {
      parent,
      desc: { title, fn, opts, stack },
    } = this;

    this.state = RunnableState.Running;
    this.runner?.emitter.emit("testStart", title);

    const { runOnly, filter } = parent?.desc.opts ?? defaultOpts;

    if (!opts.if || (runOnly && !opts.only) || !filter(title)) {
      return this.finish({ title, type: "hidden", stack });
    }

    if (opts.skip) {
      return this.finish({
        title,
        type: "skipped",
        reason: opts.skipReason,
        stack,
      });
    }

    if (opts.todo) {
      return this.finish({
        title,
        type: "todo",
        description: opts.todoDesc,
        stack,
      });
    }

    if (opts.signal?.aborted) {
      return this.finish({
        title,
        type: "skipped",
        reason: SKIP_ABORTED.reason,
        stack,
      });
    }

    enableUncaughtErrorsTracker();

    if (opts.sanitize.globals) {
      this.globals = new GlobalsSanitizer(
        opts.sanitize.globals === true ? [] : opts.sanitize.globals
      );
    }

    if (opts.sanitize.handles) {
      enableHandlesTracker();
    }

    if (opts.sanitize.exit) {
      enableExitsTracker();
    }

    if (opts.sanitize.warnings) {
      enableWarningsTracker();
    }

    const ctx: RunningContext = {
      step: desc => this.step(desc),
      group: descs => this.group(descs),
      cleanup: fn => this.addCleanup(fn),
      incAssertionCount: () => this.incAssertionCount(),
      addError: error =>
        this.addError({
          error,
          stack: getStack(1),
          user: true,
        }),
      log: (...args: unknown[]) => this.addLog(args),
      matchesSnapshot: (something: unknown, key?: string) => {
        // TODO
      },
    };

    this.timeStart = Date.now();

    let ret;
    try {
      ret = runWithCtx(this, () => fn(ctx));
    } catch (err: unknown) {
      return this.exitError(err, true);
    }

    if (opts.signal?.aborted) {
      return this.exitError(SKIP_ABORTED.reason, false);
    }

    if (ret instanceof Promise) {
      this.deferred1 = createDefer();

      if (opts.timeout != null) {
        this.timeoutId = setTimeout(
          () => this.interrupt("Timeout exceeded", false),
          opts.timeout
        );
      }

      if (opts.signal) {
        const signal = opts.signal;
        const onAbort = () => this.interrupt(SKIP_ABORTED.reason, false);
        signal.addEventListener("abort", onAbort, { once: true });
        this.cleanAbort = () => signal.removeEventListener("abort", onAbort);
      }

      return Promise.race([ret, this.deferred1.promise]).then(
        ret => this.exit(ret),
        err => this.exitError(err, true)
      );
    }

    return this.exit(ret);
  }

  private exitError(error: unknown, user: boolean) {
    this.addError({
      error,
      stack: this.desc.stack,
      user,
    });
    return this.exit(undefined);
  }

  private async exit(returnValue: unknown): Promise<RunnableResult> {
    this.state = RunnableState.Cleanup;
    this.deferred2 = createDefer();

    const {
      desc: { title, opts, stack },
      timeStart,
      timeoutId,
      cleanAbort,
      globals,
      assertionCount,
      userErrors,
      nonUserErrors,
      logs,
      tests,
      cleanups,
    } = this;
    const random = this.random?.hex ?? null;

    tests.forEach(t =>
      t.interrupt("Test did not finish before parent test finished", false)
    );

    const children = [];
    let childFailed = false;
    let childFailedWithNonUserError = false;
    for (const job of tests.map(t => t.run())) {
      const result = await job;
      children.push(result);
      childFailed ||= result.type === "failed";
      childFailedWithNonUserError ||=
        result.type === "failed" && result.nonUserErrors.length > 0;
    }

    if (!this.killed) {
      for (let i = cleanups.length - 1; i >= 0; i--) {
        const fn = cleanups[i];
        try {
          await Promise.race([fn(), this.deferred2.promise]);
        } catch (error) {
          this.addError({
            error,
            stack,
            user: true,
          });
        }
      }
    }

    const duration = Date.now() - timeStart;

    this.state = RunnableState.Exiting;
    this.deferred1 = null;
    this.deferred2 = null;

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    if (cleanAbort) {
      cleanAbort();
    }

    if (this.interrupted) {
      this.addExitError(this.interrupted);
    }

    if (returnValue !== undefined) {
      this.addExitError("Unnecessarily returning a value");
    }

    if (opts.signal?.aborted) {
      this.addExitError(SKIP_ABORTED.reason);
    }

    let memoryUsage;
    if (opts.logHeapUsage) {
      if (global.gc) global.gc();
      memoryUsage = process.memoryUsage().heapUsed;
    } else {
      memoryUsage = null;
    }

    const slow = opts.slow ? duration >= opts.slow : false;

    if (globals) {
      const err = globals.check();
      if (err) {
        this.addExitError(err);
      }
    }

    if (opts.sanitize.handles) {
      const activeHandles = await getActiveHandles(this);
      for (const { type, stack } of activeHandles) {
        this.addError({
          error: `Active handle ${type} after test finished`,
          stack,
          user: false,
        });
      }
    }

    if (userErrors.length === 0) {
      if (typeof opts.plan === "number") {
        if (opts.plan !== assertionCount) {
          this.addExitError(
            "Planned " +
              opts.plan +
              " but " +
              this.assertionCount +
              " assertions were run"
          );
        }
      } else {
        if (assertionCount === 0 && children.length === 0) {
          this.addExitError("No assertions were run");
        }
      }
    }

    let passed = true;

    if (opts.failing) {
      if (nonUserErrors.length > 0 || childFailedWithNonUserError) {
        passed = false;
      } else if (userErrors.length > 0 || childFailed) {
        passed = true;
      } else {
        this.addExitError("Test was expected to fail, but succeeded");
        passed = false;
      }
    } else {
      passed =
        userErrors.length === 0 && nonUserErrors.length === 0 && !childFailed;
    }

    return passed
      ? this.finish({
          title,
          type: "passed",
          logs,
          duration,
          slow,
          memoryUsage,
          random,
          children,
          stack,
        })
      : this.finish({
          title,
          type: "failed",
          userErrors,
          nonUserErrors,
          logs,
          duration,
          slow,
          memoryUsage,
          random,
          children,
          stack,
        });
  }
}
