import turbocolor from "turbocolor";
import logSymbols from "log-symbols";
import ora, { Ora } from "ora";
import { codeFrameColumns } from "@babel/code-frame";
import { prettify } from "../../../../util/path-url";
import { never } from "../../../../util/miscellaneous";
import { BeautifiedStackLine, beautify } from "../../../../error/src/index";
import { SourceMapExtractor } from "../../../../source-map/src/extractor";
import { IRunner } from "./runner";
import { type RunnableResult, type SimpleError } from "./runnable";
import { concordanceOptions } from "./concordance-options";
import { SKIP_ABORTED, SKIP_BAILED, SKIP_INTERRUPTED } from "./constants";
import { inspect } from "util";

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

export class Reporter {
  private spinner: Ora;
  private ended: boolean;
  private didShowMoreErrors: boolean;
  private interrupted: boolean;
  private runningTests: Set<string>;
  private otherErrors: SimpleError[];

  constructor(private readonly runner: IRunner) {
    this.spinner = ora("Waiting...");
    this.ended = false;
    this.didShowMoreErrors = false;
    this.interrupted = false;
    this.runningTests = new Set();
    this.otherErrors = [];

    runner.emitter.on("uncaughtError", err => {
      this.otherErrors.push(err);
      if (this.ended) {
        this.logOtherErrors();
      }
    });

    runner.emitter.on("started", ({ amount, total }) => {
      // TODO this.showConcurrency(runner);
      // TODO this.showDebuggers(runner);
      this.runnerStarted(amount, total);
    });

    runner.emitter.on("finished", async result => {
      // console.log(inspect(result, { depth: 100 }));
      await this.runnerFinished(result);
      await this.logOtherErrors();

      if (this.interrupted) {
        log(`\n${turbocolor.bold.red("Interrupted.")}\n\n`);
      }

      if (process.exitCode) {
        log(turbocolor.bold.red("Exit code: " + process.exitCode));
      } else {
        log(turbocolor.bold.green("Exit code: 0"));
      }
      logEol();
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

    runner.emitter.on("sigint", _try => {
      this.interrupted = true;
      this.spinner.stop();
      log(`\nStopping tests... (${_try} try)\n`);
    });
  }

  showOptions(options: TestRunnerOptions) {
    logEol();
    log(turbocolor.bold.green("Patterns: ") + options.files.join(" ") + "\n");
    if (options.ignore.length > 0) {
      log(
        turbocolor.bold.green("Ignore patterns: ") +
          options.ignore.join(" ") +
          "\n"
      );
    }
    logEol();
  }

  showFilesCount(count: number, time: number) {
    log(`${turbocolor.bold.green(`Found ${count} files`)} in ${time} ms\n`);
    logEol();
  }

  showConcurrency() {
    log(turbocolor.bold.green("Child processes: ") + this.forks.length + "\n");
    logEol();
  }

  showDebuggers() {
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
    });
  }

  static fatalError(error: string) {
    process.exitCode = 1;
    logEol();
    log(turbocolor.bold.red(error));
    logEol();
  }

  runnerStarted(amount: number, total: number) {
    this.spinner.start();
    this.spinner.text = "Running tests...";
  }

  async runnerFinished(result: RunnableResult) {
    this.spinner.stop();
    await this.logResult("", result);
    this.ended = true;
    return;

    setTimeout(async () => {
      const notStartedForks = t.notStartedForks;
      const hasPending = t.pendingTests && t.pendingTests.size > 0;

      // If we had pending tests, don't trust the stats
      if (notStartedForks.length > 0 || hasPending) {
        if (notStartedForks.length > 0) {
          log(
            `\n${turbocolor.bold.red(
              `${notStartedForks.length} child ${
                notStartedForks.length === 1 ? "process" : "processes"
              }` + ` did not emit "runStart" event.`
            )}\n`
          );
          log(`\nPossible causes:\n`);

          for (const { didCrash, notImportedFiles } of notStartedForks) {
            if (didCrash || notImportedFiles.size === 0) {
              log(`  - Some error during setup. See below.\n`);
            } else {
              for (const file of notImportedFiles) {
                log(`  - Infinite loop or error in ${prettify(file)}\n`);
                break; // Only show the first one, since files are imported by order
              }
            }
          }
        }

        if (hasPending) {
          log(
            `\n${turbocolor.bold.red(
              `${t.pendingTests.size} Pending tests:`
            )}\n`
          );

          for (const stack of t.pendingTests) {
            await this.logDefault(stack);
          }
        }
      } else {
        const { passed, skipped, todo, failed, total } = t.testCounts;

        let lines;

        if (total === 0) {
          lines = [turbocolor.red("\n  The total number of tests was 0.")];
        } else {
          lines = [
            passed > 0 ? "\n  " + turbocolor.green(passed + " passed") : "",
            skipped > 0 ? "\n  " + turbocolor.yellow(skipped + " skipped") : "",
            todo > 0 ? "\n  " + turbocolor.blue(todo + " todo") : "",
            failed > 0 ? "\n  " + turbocolor.red(failed + " failed") : "",
            "\n\n  " + turbocolor.gray(t.runtime + " ms"),
            t.onlyCount
              ? `\n\n  The '.only' modifier was used ${t.onlyCount} time${
                  t.onlyCount === 1 ? "" : "s"
                }.`
              : "",
          ].filter(Boolean);
        }

        if (this.runner.options.only) {
          lines.push("\n  --only option was used.");
        }

        if (this.runner.options.bail) {
          lines.push("\n  --bail option was used.");
        }

        if (t.snapshotStats) {
          this.showSnapshotStats(lines, t.snapshotStats);
        }

        process.stdout.write(lines.join("") + "\n");
      }

      log(`\n${turbocolor.gray(`[${new Date().toLocaleTimeString()}]`)}\n\n`);

      this.ended = true;

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
  }

  showSnapshotStats(
    lines: string[],
    { added, updated, removed, obsolete }: SnapshotStats
  ) {
    if (added || updated || removed || obsolete) {
      lines.push(turbocolor.blue("\n\n  Snapshots"));
    }
    if (added) {
      lines.push(turbocolor.green(`\n    Added: ${added}`));
    }
    if (updated) {
      lines.push(turbocolor.green(`\n    Updated: ${updated}`));
    }
    if (removed) {
      lines.push(turbocolor.red(`\n    Removed: ${removed}`));
    }
    if (obsolete) {
      lines.push(turbocolor.red(`\n    Obsolete: ${obsolete}`));
    }
  }

  async beautifyStack(stack: string) {
    return beautify(stack, {
      extractor: new SourceMapExtractor(),
      ignore: this.runner.runnerGlobalOpts.errorOpts.stackIgnore,
    });
  }

  showSource(source: BeautifiedStackLine | null) {
    if (!source) return "";

    const { file, code, line, column } = source;

    if (!file || !code || line == null) {
      if (file) {
        return `${turbocolor.gray(`${prettify(file)}:${line}:${column}`)}\n\n`;
      }
      return "";
    }

    const frame = this.runner.runnerGlobalOpts.errorOpts.codeFrame
      ? codeFrameColumns(code, { start: { line } }, {}) + "\n\n"
      : "";

    return `${turbocolor.gray(
      `${prettify(file)}:${line}:${column}`
    )}\n\n${frame}`;
  }

  async logOtherErrors() {
    const otherErrors = this.otherErrors;
    this.otherErrors = [];

    if (otherErrors.length > 0) {
      if (!this.didShowMoreErrors) {
        this.didShowMoreErrors = true;
        log(`\n${turbocolor.bold("More errors:")}\n`);
      }

      for (let i = 0; i < otherErrors.length; i++) {
        await this.logError(otherErrors[i]);
      }
    }
  }

  async logDefault(defaultStack: string) {
    let { source } = await this.beautifyStack(defaultStack);
    let text = "\n";

    if (source) {
      text += this.showSource(source);
    }

    log(text, 4);
  }

  async logError(error: SimpleError) {
    const { diff: showDiff, stack: showStack } =
      this.runner.runnerGlobalOpts.errorOpts;

    let text = "\n";

    if (error.message) {
      text += turbocolor.bold(error.message) + "\n";
    }

    const { stack, source } = await this.beautifyStack(error.stack);

    text += this.showSource(source);

    if (showDiff && error.diff) {
      const { diffGutters } = concordanceOptions.theme;
      text += `${diffGutters.actual}Actual ${diffGutters.expected}Expected\n\n${indentString(error.diff)}\n\n`;
    }

    if (showStack && stack) {
      text += turbocolor.gray(stack) + "\n\n";
    }

    log(text, 4);
  }

  async logResult(parentTitle: string, result: RunnableResult) {
    if (result.type === "hidden") return;
    if (!this.runner.runnerGlobalOpts.verbose) {
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

    const title = parentTitle
      ? `${parentTitle} > ${result.title}`
      : result.title;

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

    log(`\n${turbocolor.bold(title)}\n`);

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
      log("Logs:\n\n", 4);

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
      log(turbocolor.yellow(`Memory usage: ${memoryUsage}\n`), 4);
      logEol();
    }

    if (children) {
      if (random) {
        log(turbocolor.bold.yellow("Random seed: ") + random + "\n");
        logEol();
      }
      for (const child of children) {
        await this.logResult(title, child);
      }
    }
  }
}
