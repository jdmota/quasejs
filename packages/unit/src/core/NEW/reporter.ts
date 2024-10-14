import turbocolor from "turbocolor";
import logSymbols from "log-symbols";
import ora, { Ora } from "ora";
import { codeFrameColumns } from "@babel/code-frame";
import { prettify } from "../../../../util/path-url";
import { never, Optional } from "../../../../util/miscellaneous";
import { BeautifiedStackLine, beautify } from "../../../../error/src/index";
import { SourceMapExtractor } from "../../../../source-map/src/extractor";
import { IRunner } from "./runner";
import { type RunnableResult } from "./runnable";
import { type SimpleError } from "./errors";
import { coloredConcordanceOptions } from "./concordance-options";
import { SKIP_ABORTED, SKIP_BAILED, SKIP_INTERRUPTED } from "./constants";
import {
  addSnapshotStats,
  newMutableSnapshotStats,
  SnapshotStats,
} from "./snapshots";
import { exit } from "./sanitizers/process-sanitizer";

const eol = turbocolor.reset("\n");

export function indentString(str: string, indent?: string | number) {
  indent = indent || 2;
  return (str + "").replace(
    /^(?!\s*$)/gm,
    typeof indent === "number" ? " ".repeat(indent) : indent
  );
}

export function log(str: string, indent?: string | number) {
  process.stdout.write(indentString(str, indent));
}

export function logEol() {
  process.stdout.write(eol);
}

export type ReporterOpts = Readonly<{
  color?: boolean | null; // @default("auto") @description("Force or disable. Default: auto detection");
  verbose: boolean;
  errorOpts: Readonly<{
    diff: boolean;
    codeFrame: boolean;
    stack: boolean;
    stackIgnore: Optional<{
      test(text: string): boolean;
    }>;
  }>;
}>;

export class Reporter {
  private spinner: Ora;
  private ended: boolean;
  private didShowMoreErrors: boolean;
  private runningTests: Set<string>;
  private otherErrors: SimpleError[];
  private snapshotStats = newMutableSnapshotStats();

  constructor(
    private readonly runner: IRunner,
    private readonly opts: ReporterOpts
  ) {
    this.spinner = ora({
      text: "Waiting...",
      hideCursor: false, // https://github.com/sindresorhus/ora/pull/80
    });
    this.ended = false;
    this.didShowMoreErrors = false;
    this.runningTests = new Set();
    this.otherErrors = [];
    this.onSigint = this.onSigint.bind(this);

    runner.emitter.on("uncaughtError", err => {
      this.otherErrors.push(err);
      if (this.ended) {
        this.logOtherErrors();
      }
    });

    runner.emitter.on("started", ({ amount, total }) => {
      this.runnerStarted(amount, total);
    });

    runner.emitter.on("finished", async result => {
      // console.log(inspect(result, { depth: 100 }));
      await this.runnerFinished(result);
      await this.logOtherErrors();
    });

    runner.emitter.on("testStart", title => {
      this.runningTests.add(title);
      for (const text of this.runningTests) {
        this.spinner.text = text;
        return;
      }
    });

    runner.emitter.on("testFinish", title => {
      this.runningTests.delete(title);
      for (const text of this.runningTests) {
        this.spinner.text = text;
        return;
      }
    });

    runner.emitter.on("debuggerListening", ({ socket, files }) => {
      // TODO
      console.log("Debugging...", socket, files);
    });

    runner.emitter.on("debuggerWaitingDisconnect", ({ socket, files }) => {
      // TODO
      console.log("Waiting debugger disconnect...", socket, files);
    });

    process.on("SIGINT", this.onSigint);

    process.on("beforeExit", () => {
      this.logOtherErrors();

      if (process.exitCode) {
        log(turbocolor.bold.red("Exit code: " + process.exitCode));
      } else {
        log(turbocolor.bold.green("Exit code: 0"));
      }
      logEol();
    });
  }

  private sigintTry = 0;
  onSigint() {
    this.sigintTry++;
    log(
      `\n${[
        (this.sigintTry === 1 ? "--> " : "    ") +
          "1 sigint: interrupt tests but run cleanups",
        (this.sigintTry === 2 ? "--> " : "    ") +
          "2 sigints: interrupt tests forcefully",
        (this.sigintTry === 3 ? "--> " : "    ") + "3 sigints: kill forks",
      ].join("\n")}\n`
    );
    if (this.sigintTry === 1) {
      this.runner.sigint(false, "SIGINT");
    } else if (this.sigintTry === 2) {
      this.runner.sigint(true, "SIGINT (2)");
    } else if (this.sigintTry === 3) {
      process.off("SIGINT", this.onSigint);
      this.runner.killForks().then(async () => {
        if (this.runner.workerType() === "main") {
          await this.logOtherErrors();
          exit(1);
        }
      });
    }
  }

  showFilesCount(count: number, time: number) {
    log(`${turbocolor.bold.green(`Found ${count} files`)} in ${time} ms\n`);
    logEol();
  }

  /*showDebuggers() {
    if (!this.debuggersPromises.length) {
      return;
    }
    Promise.all(this.debuggersPromises).then(debuggers => {
      log(turbocolor.bold.yellow("Debugging"));
      logEol();
      log(
        turbocolor.bold.yellow(
          "Got to chrome://inspect or check https://nodejs.org/en/docs/inspector"
        )
      );
      logEol();
      for (let i = 0; i < debuggers.length; i++) {
        log(turbocolor.bold(debuggers[i]), 4);
        logEol();
        for (const file of this.division[i]) {
          log(prettify(file), 6);
          logEol();
        }
      }
      logEol();

      const debuggersWaitingPromises = this.runner.debuggersWaitingPromises;

      if (debuggersWaitingPromises.length) {
        Promise.race(debuggersWaitingPromises).then(() => {
          log(
            turbocolor.bold.yellow(
              "At least 1 of " +
                debuggersWaitingPromises.length +
                " processes are waiting for the debugger to disconnect...\n"
            )
          );
          logEol();
        });
      }
    });
  }*/

  static fatalError(error: string) {
    process.exitCode = 1;
    logEol();
    log(turbocolor.bold.red(error));
    logEol();
  }

  private workersAmount = 0;

  runnerStarted(amount: number, total: number) {
    // TODO this.showDebuggers(runner);
    this.workersAmount = total;
    this.spinner.start();
    this.spinner.text = "Running tests...";
  }

  async runnerFinished(result: RunnableResult) {
    this.spinner.stop();
    await this.logResult(result, true);

    logEol();
    logEol();

    if (result.type === "hidden") {
      log(turbocolor.red("\n  Hidden test suite.") + "\n");
    } else if (result.type === "todo") {
      log(turbocolor.red("\n  Todo test suite.") + "\n");
    } else if (result.type === "skipped") {
      log(turbocolor.red("\n  Skipped test suite.") + "\n");
    } else {
      if (result.children.length === 0) {
        log(turbocolor.red("\n  The total number of tests was 0.") + "\n");
      } else {
        const counts = {
          passed: 0,
          skipped: 0,
          todo: 0,
          failed: 0,
        };
        for (const test of result.children) {
          if (test.type !== "hidden") counts[test.type]++;
        }
        const { passed, skipped, todo, failed } = counts;
        if (passed) {
          log(turbocolor.green(passed + " passed") + "\n");
        }
        if (skipped) {
          log(turbocolor.yellow(skipped + " skipped") + "\n");
        }
        if (todo) {
          log(turbocolor.blue(todo + " todo") + "\n");
        }
        if (failed) {
          log(turbocolor.red(failed + " failed") + "\n");
        }

        this.showSnapshotStats(this.snapshotStats);

        log("\n" + turbocolor.gray(result.duration + " ms") + "\n");
      }
    }

    log(
      "\n" +
        turbocolor.bold.white(
          this.runner.workerType() === "main"
            ? "Used main thread"
            : this.runner.workerType() === "workers"
              ? `Used ${this.workersAmount} worker(s)`
              : `Used ${this.workersAmount} process(es)`
        ) +
        "\n"
    );

    log(
      turbocolor.bold.white(
        `Executed ${this.runner.filesNumber()} test file(s)`
      ) + "\n"
    );

    log(`\n${turbocolor.gray(`[${new Date().toLocaleTimeString()}]`)}\n\n`);

    this.ended = true;
  }

  showSnapshotStats({
    added,
    updated,
    removed,
    missing,
    missmatched,
    obsolete,
    total,
  }: SnapshotStats) {
    if (added || updated || removed || missing || missmatched || obsolete) {
      logEol();
    }
    if (added) {
      log(turbocolor.green(`Snapshots added: ${added}`) + "\n");
    }
    if (updated) {
      log(turbocolor.green(`Snapshots updated: ${updated}`) + "\n");
    }
    if (removed) {
      log(turbocolor.red(`Snapshots removed: ${removed}`) + "\n");
    }
    if (missing) {
      log(turbocolor.red(`Snapshots missing: ${missing}`) + "\n");
    }
    if (missmatched) {
      log(turbocolor.red(`Snapshots missmatched: ${missmatched}`) + "\n");
    }
    if (obsolete) {
      log(turbocolor.red(`Snapshots obsolete: ${obsolete}`) + "\n");
    }
  }

  async beautifyStack(stack: string) {
    if (!stack) {
      return {
        stack: "",
        source: null,
      };
    }
    return beautify(stack, {
      extractor: new SourceMapExtractor(),
      ignore: this.opts.errorOpts.stackIgnore,
    });
  }

  showSource(source: BeautifiedStackLine | null) {
    if (!source) return "";

    const { file, code, line, column } = source;

    if (!file || !code || line == null) {
      if (file) {
        return `${turbocolor.gray(`${prettify(file)}:${line}:${column}`)}\n`;
      }
      return "";
    }

    const frame = this.opts.errorOpts.codeFrame
      ? codeFrameColumns(code, { start: { line } }, {}) + "\n"
      : "";

    return `${turbocolor.gray(
      `${prettify(file)}:${line}:${column}`
    )}\n${frame}`;
  }

  async logOtherErrors() {
    this.spinner.stop();

    const otherErrors = this.otherErrors;
    this.otherErrors = [];

    if (otherErrors.length > 0) {
      if (!this.didShowMoreErrors) {
        this.didShowMoreErrors = true;
        log(`\n${turbocolor.red.bold("More errors:")}\n`);
      }

      for (let i = 0; i < otherErrors.length; i++) {
        await this.logError(otherErrors[i]);
      }
    }
  }

  async logDefault(defaultStack: string) {
    const { source } = await this.beautifyStack(defaultStack);
    const text = this.showSource(source);
    if (text) {
      log("\n" + text, 4);
    }
  }

  async logError(error: SimpleError) {
    const { diff: showDiff, stack: showStack } = this.opts.errorOpts;

    let text = "\n";

    if (error.message) {
      text += turbocolor.bold(error.message) + "\n";
    }

    const { stack, source } = await this.beautifyStack(error.stack);

    text += this.showSource(source);

    if (showDiff && error.diff) {
      const { diffGutters } = coloredConcordanceOptions.theme;
      text += `\n${diffGutters.actual}Actual ${diffGutters.expected}Expected\n\n${indentString(error.diff)}\n\n`;
    }

    if (showStack && stack) {
      text += turbocolor.gray(stack) + "\n\n";
    }

    log(text, 4);
  }

  async logResult(result: RunnableResult, isRunner = false) {
    if (result.type === "hidden") return;

    if (result.type === "passed" || result.type === "failed") {
      if (result.snapshots)
        addSnapshotStats(this.snapshotStats, result.snapshots);
    }

    if (!this.opts.verbose) {
      switch (result.type) {
        case "passed":
          if (!result.slow && !result.logs.length) {
            return;
          }
          break;
        case "failed":
          break;
        case "skipped":
          if (
            result.reason === SKIP_ABORTED.reason ||
            result.reason === SKIP_BAILED.reason ||
            result.reason === SKIP_INTERRUPTED.reason
          ) {
            return;
          }
          break;
        case "todo":
          break;
        default:
          never(result);
      }
    }

    const statusText =
      result.type === "failed"
        ? turbocolor.red(result.type)
        : result.type === "passed"
          ? turbocolor.green(result.type)
          : turbocolor.yellow(result.type);

    const slow =
      result.type === "passed" || result.type === "failed"
        ? result.slow
        : false;

    const duration =
      result.type === "passed" || result.type === "failed"
        ? result.duration
        : 0;

    const logs =
      result.type === "passed" || result.type === "failed" ? result.logs : [];

    const memoryUsage =
      result.type === "passed" || result.type === "failed"
        ? result.memoryUsage
        : null;

    const random =
      result.type === "passed" || result.type === "failed"
        ? result.random
        : undefined;

    const children =
      result.type === "passed" || result.type === "failed"
        ? result.children
        : undefined;

    log(`\n${turbocolor.bold(isRunner ? "RUNNER" : result.title)}\n`);

    if (slow || duration) {
      log(
        `${statusText} | ${duration} ms ${
          slow ? turbocolor.yellow("Slow!") : ""
        }\n`
      );
    } else {
      log(`${statusText}\n`);
    }

    if (result.type === "skipped") {
      log(`\nSkip reason: ${result.reason}\n`, 4);
    } else if (result.type === "todo") {
      log(`\nTodo description: ${result.description}\n`, 4);
    }

    if (result.type === "failed") {
      for (const error of result.userErrors) {
        await this.logError(error);
      }
      for (const error of result.nonUserErrors) {
        await this.logError(error);
      }
    } else {
      await this.logDefault(result.stack);
    }

    if (logs.length) {
      log("\nLogs:\n\n", 4);

      for (const line of logs) {
        const logLines = indentString(turbocolor.gray(line), 6);
        const logLinesWithFigure = logLines.replace(
          /^ {6}/,
          `    ${logSymbols.info} `
        );

        log(logLinesWithFigure, 0);
        logEol();
      }
    }

    if (memoryUsage) {
      log("\n" + turbocolor.yellow(`Memory usage: ${memoryUsage}\n`), 4);
      logEol();
    }

    if (children) {
      if (random) {
        log("\n" + turbocolor.bold.yellow("Random seed: ") + random + "\n");
        logEol();
      }
      for (const child of children) {
        await this.logResult(child);
      }
    }
  }
}
