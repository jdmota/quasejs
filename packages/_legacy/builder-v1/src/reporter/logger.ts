// Adapted from parcel-bundler's logger
import { formatError, Error2 } from "../utils/error";

const colorette = require("colorette");
const readline = require("readline");
const stripAnsi = require("strip-ansi");
const ora = require("ora");
const path = require("path");
const fs = require("fs");

const supportsEmoji =
  process.platform !== "win32" || process.env.TERM === "xterm-256color";

// Fallback symbols for Windows from https://en.wikipedia.org/wiki/Code_page_437
const emoji = {
  progress: supportsEmoji ? "⏳" : "∞",
  success: supportsEmoji ? "✨" : "√",
  error: supportsEmoji ? "🚨" : "×",
  warning: supportsEmoji ? "⚠️" : "‼",
  info: supportsEmoji ? "ℹ" : "i",
};

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
  emoji?: any;
  isTest?: boolean;
};

export default class Logger {
  lines: number;
  spinner: any;
  logFile: any | null;
  logLevel: number;
  color: boolean;
  emoji: any;
  isTest: boolean;

  constructor(options: LoggerOpts = {}) {
    this.lines = 0;
    this.spinner = null;
    this.logFile = null;

    this.logLevel = options.logLevel == null ? 3 : Number(options.logLevel);
    this.color = colorette.options.enabled =
      typeof options.color === "boolean"
        ? options.color
        : colorette.options.enabled;
    this.emoji = options.emoji || emoji;
    this.isTest = !!options.isTest;
  }

  _log(message: string) {
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

  _writeError(
    err: string | Error2,
    emoji: string,
    color: (msg: string) => string
  ) {
    const { message, stack } = formatError(err);
    this.write(color(`${emoji}  ${message}`));
    if (stack) {
      if (!this.isTest || (typeof err !== "string" && err.codeFrame)) {
        this.write(stack);
      }
    }
  }

  write(message: string, persistent = false) {
    if (!persistent) {
      this.lines += countLines(message);
    }
    this.stopSpinner();
    this._log(message);
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

  info(message: string) {
    this.log(`${this.emoji.info}  ${colorette.bold(colorette.blue(message))}`);
  }

  success(message: string) {
    this.log(
      `${this.emoji.success}  ${colorette.bold(colorette.green(message))}`
    );
  }

  warn(err: string | Error) {
    if (this.logLevel > 1) {
      this._writeError(err, this.emoji.warning, colorette.yellow);
    }
  }

  error(err: string | Error) {
    if (this.logLevel > 0) {
      this._writeError(err, this.emoji.error, m =>
        colorette.bold(colorette.red(m))
      );
    }
  }

  progress(message: string) {
    if (this.logLevel < 3) {
      return;
    }

    if (this.logLevel > 3) {
      return this.log(message);
    }

    const styledMessage = colorette.bold(colorette.gray(message));
    if (this.spinner) {
      this.spinner.text = styledMessage;
    } else {
      this.spinner = ora({
        text: styledMessage,
        stream: process.stdout,
        enabled: this.isTest ? false : undefined,
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
      this.log(items.join(""));
    }
  }
}
