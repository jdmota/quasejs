import fs from "fs-extra";
import path from "path";
import readline from "readline";
import colorette from "colorette";
import ora from "ora";
import stripAnsi from "strip-ansi";
import {
  formatDiagnostic,
  Diagnostic,
  createDiagnosticFromAny,
} from "../utils/error";
import emoji from "../utils/emoji";

// Pad a string with spaces on either side
function pad(text: string, length: number, align: "left" | "right" = "left") {
  let pad = " ".repeat(length - text.length);
  if (align === "right") {
    return pad + text;
  }
  return text + pad;
}

function countLines(message: string) {
  return stripAnsi(message)
    .split("\n")
    .reduce((p: number, line: string) => {
      if (process.stdout.columns) {
        return p + Math.ceil((line.length || 1) / process.stdout.columns);
      }
      return p + 1;
    }, 0);
}

// 0 Logging disabled
// 1 Only log errors
// 2 Log errors and warnings
// 3 Log everything (shows progress with spinner)
// 4 Verbose (keep everything in log with timestamps) (shows progress with text)
// 5 Debug (save everything to a file with timestamps) (shows progress with text)

type LoggerOpts = {
  logLevel?: number;
  color?: boolean;
  isTest?: boolean;
};

export default class Logger {
  lines: number;
  spinner: ora.Ora | null;
  logFile: fs.WriteStream | null;
  logLevel: number;
  color: boolean;
  isTest: boolean;

  constructor(options: LoggerOpts = {}) {
    this.lines = 0;
    this.spinner = null;
    this.logFile = null;

    this.logLevel = options.logLevel == null ? 3 : options.logLevel;
    this.color = colorette.options.enabled =
      typeof options.color === "boolean"
        ? options.color
        : colorette.options.enabled;
    this.isTest = !!options.isTest;
  }

  write(message: string, persistent = false) {
    if (!persistent) {
      this.lines += countLines(message);
    }
    this.stopSpinner();

    if (this.logLevel > 3) {
      message = `[${new Date().toLocaleTimeString()}]: ${message}`;
    }

    console.log(message); // eslint-disable-line no-console

    if (this.logLevel > 4) {
      if (!this.logFile) {
        this.logFile = fs.createWriteStream(
          path.join(process.cwd(), "quase-builder-debug.log")
        );
      }
      this.logFile.write(stripAnsi(message) + "\n");
    }
  }

  log(message: string) {
    if (this.logLevel > 2) {
      this.write(message);
    }
  }

  persistent(message: string) {
    if (this.logLevel > 2) {
      this.write(colorette.bold(message), true);
    }
  }

  success(message: string) {
    if (this.logLevel > 2) {
      this.write(
        `${emoji.success}  ${colorette.bold(colorette.green(message))}`
      );
    }
  }

  diagnostic(diagnostic: Diagnostic) {
    switch (diagnostic.category) {
      case "info":
        if (this.logLevel > 2) this.write(formatDiagnostic(diagnostic));
        break;
      case "warn":
        if (this.logLevel > 1) this.write(formatDiagnostic(diagnostic));
        break;
      case "error":
        if (this.logLevel > 0) this.write(formatDiagnostic(diagnostic));
        break;
      default: {
        const _: never = diagnostic.category;
      }
    }
  }

  info(message: string | Error) {
    if (this.logLevel > 2) {
      this.diagnostic(createDiagnosticFromAny(message, "info"));
    }
  }

  warn(warning: string | Error) {
    if (this.logLevel > 1) {
      this.diagnostic(createDiagnosticFromAny(warning, "warn"));
    }
  }

  error(error: string | Error) {
    if (this.logLevel > 0) {
      this.diagnostic(createDiagnosticFromAny(error, "error"));
    }
  }

  progress(message: string) {
    if (this.logLevel < 3) {
      return;
    }

    if (this.logLevel > 3) {
      return this.write(message);
    }

    const styledMessage = colorette.bold(colorette.gray(message));
    if (this.spinner) {
      this.spinner.text = styledMessage;
    } else {
      this.spinner = ora({
        text: styledMessage,
        stream: process.stdout,
        isEnabled: this.isTest ? false : undefined,
      }).start();
    }
  }

  stopSpinner() {
    if (this.spinner) {
      this.spinner.stop();
      this.spinner = null;
    }
  }

  clear() {
    if (!this.color || this.isTest || this.logLevel > 3) {
      return;
    }

    while (this.lines > 0) {
      readline.clearLine(process.stdout, 0);
      readline.moveCursor(process.stdout, 0, -1);
      this.lines--;
    }

    readline.cursorTo(process.stdout, 0);
    this.stopSpinner();
  }

  table(columns: { align: "left" | "right" }[], table: (string | number)[][]) {
    if (this.logLevel <= 2) return;

    // Measure column widths
    const colWidths: number[] = [];
    for (let row of table) {
      let i = 0;
      for (const item of row) {
        colWidths[i] = Math.max(colWidths[i] || 0, (item + "").length);
        i++;
      }
    }

    // Render rows
    for (const row of table) {
      const items = row.map(
        (item, i) =>
          ` ${pad(
            item + "",
            colWidths[i],
            columns[i] ? columns[i].align : undefined
          )} `
      );
      this.write(items.join(""));
    }
  }
}
