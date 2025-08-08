import { formatWithOptions, stripVTControlCharacters } from "node:util";
import { streamSupportColors } from "./terminal";

export type LoggerLevel = number;

// Inspired on Log4j (but adds LOG level)
export enum LoggerVerboseLevel {
  OFF = 0,
  FATAL = 100,
  ERROR = 200,
  WARN = 300,
  INFO = 400,
  LOG = 500,
  DEBUG = 600,
  TRACE = 700,
  ALL = Number.MAX_SAFE_INTEGER,
}

export function loggerLevelToStr(level: LoggerLevel) {
  switch (level) {
    case LoggerVerboseLevel.FATAL:
      return "FATAL";
    case LoggerVerboseLevel.ERROR:
      return "ERROR";
    case LoggerVerboseLevel.WARN:
      return "WARN";
    case LoggerVerboseLevel.INFO:
      return "INFO";
    case LoggerVerboseLevel.LOG:
      return "LOG";
    case LoggerVerboseLevel.DEBUG:
      return "DEBUG";
    case LoggerVerboseLevel.TRACE:
      return "TRACE";
    default:
      return level + "";
  }
}

export type LoggerLevelFilterFn = (level: LoggerLevel) => boolean;

export type LoggerLevelFilter = LoggerLevel | LoggerLevelFilterFn;

export type LoggerStreams = readonly [
  NodeJS.WritableStream,
  LoggerLevelFilter,
][];

export type LoggerOpts = {
  readonly renderPrefix?: LoggerPrefixRender;
  readonly verbose?: LoggerLevelFilter;
  readonly colors?: boolean;
  readonly streams?: LoggerStreams;
};

function levelToFilter(level: LoggerLevelFilter): LoggerLevelFilterFn {
  if (typeof level === "number") {
    return (l: LoggerLevel) => l <= level;
  }
  return level;
}

export type LoggerPrefixRender = (
  name: string,
  date: Date,
  level: LoggerLevel
) => string;

type LoggerDefaultOpts = {
  readonly renderPrefix: LoggerPrefixRender;
  readonly verbose: LoggerLevelFilter;
  readonly colors: boolean;
  readonly streams: LoggerStreams;
};

const DEFAULT_OPTS: LoggerDefaultOpts = {
  renderPrefix: (name, date, level) =>
    `[${date.toISOString()}][${name}][${loggerLevelToStr(level)}]`,
  verbose: l => l <= LoggerVerboseLevel.ALL,
  colors: true,
  streams: [
    [process.stderr, l => l <= LoggerVerboseLevel.WARN],
    [process.stdout, l => LoggerVerboseLevel.WARN < l],
  ],
};

export class Logger {
  static DEFAULT_OPTS: LoggerDefaultOpts = DEFAULT_OPTS;

  public readonly name: string;
  private renderPrefix: LoggerPrefixRender;
  private verbose: LoggerLevelFilterFn;
  private colors: boolean;
  private streams: Map<NodeJS.WritableStream, LoggerLevelFilterFn>;

  constructor(
    name: string,
    { renderPrefix, verbose, colors, streams }: LoggerOpts = {}
  ) {
    this.name = name;
    this.renderPrefix = renderPrefix ?? DEFAULT_OPTS.renderPrefix;
    this.verbose = levelToFilter(verbose ?? DEFAULT_OPTS.verbose);
    this.colors = colors ?? DEFAULT_OPTS.colors;
    this.streams = new Map(
      (streams ?? DEFAULT_OPTS.streams).map(([s, l]) => [s, levelToFilter(l)])
    );
  }

  setRenderPrefix(renderPrefix: LoggerPrefixRender) {
    this.renderPrefix = renderPrefix;
  }

  setLevel(filter: LoggerLevelFilter) {
    this.verbose = levelToFilter(filter);
  }

  setColors(colors: boolean) {
    this.colors = colors;
  }

  setStream(stream: NodeJS.WritableStream, filter: LoggerLevelFilter) {
    this.streams.set(stream, levelToFilter(filter));
  }

  removeStream(stream: NodeJS.WritableStream) {
    this.streams.delete(stream);
  }

  write(level: LoggerLevel, args: readonly unknown[]) {
    if (!this.verbose(level)) return;
    this.writeMessage(
      level,
      formatWithOptions({ colors: this.colors }, ...args)
    );
  }

  private writeMessage(level: LoggerLevel, givenMessage: string) {
    const formatedPrefix = this.renderPrefix(this.name, new Date(), level);
    const message = formatedPrefix
      ? `${formatedPrefix} ${givenMessage}\n`
      : `${givenMessage}\n`;
    for (const [stream, filter] of this.streams) {
      if (!filter(level)) continue;
      if (!this.colors || streamSupportColors(stream)) {
        stream.write(message);
      } else {
        stream.write(stripVTControlCharacters(message));
      }
    }
  }

  fatal(...args: readonly unknown[]) {
    this.write(LoggerVerboseLevel.FATAL, args);
  }

  error(...args: readonly unknown[]) {
    this.write(LoggerVerboseLevel.ERROR, args);
  }

  warn(...args: readonly unknown[]) {
    this.write(LoggerVerboseLevel.WARN, args);
  }

  info(...args: readonly unknown[]) {
    this.write(LoggerVerboseLevel.INFO, args);
  }

  log(...args: readonly unknown[]) {
    this.write(LoggerVerboseLevel.LOG, args);
  }

  debug(...args: readonly unknown[]) {
    this.write(LoggerVerboseLevel.DEBUG, args);
  }

  trace(...args: readonly unknown[]) {
    const err = {
      name: "Trace",
      message: formatWithOptions({ colors: this.colors }, ...args),
    };
    Error.captureStackTrace(err, this.trace);
    this.writeMessage(LoggerVerboseLevel.TRACE, (err as any).stack);
  }
}
