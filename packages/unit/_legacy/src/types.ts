import { ContextRef } from "./core/context";

export type WhyIsRunning = {
  type: string;
  stack: string;
}[];

export type Test = {};

export type ChildSuite = {};

export type Status = "passed" | "failed" | "skipped" | "todo";

export type RunStart = {
  type: "runStart";
  name: string;
  fullname: string[];
  tests: TestStart[];
  childSuites: SuiteStart[];
  testCounts: {
    passed: undefined;
    failed: undefined;
    skipped: undefined;
    todo: undefined;
    total: number;
  };
};

export type SnapshotStats = {
  added: number;
  updated: number;
  removed: number;
  obsolete: number;
};

export type RunEnd = {
  type: "runEnd";
  name: string;
  fullname: string[];
  status: Status;
  runtime: number;
  tests: TestEnd[];
  childSuites: SuiteEnd[];
  testCounts: {
    passed: number;
    failed: number;
    skipped: number;
    todo: number;
    total: number;
  };
  snapshotStats: SnapshotStats;
  onlyCount: number;
  whyIsRunning: WhyIsRunning;
  pendingTests: Set<string>;
  notStartedForks: {
    didCrash: boolean;
    notImportedFiles: Set<string>;
  }[];
  interrupted: boolean;
};

export type SuiteStart = {
  type: "suiteStart";
  name: string;
  fullname: string[];
  tests: TestStart[];
  childSuites: SuiteStart[];
  defaultStack: string;
  testCounts: {
    passed: undefined;
    failed: undefined;
    skipped: undefined;
    todo: undefined;
    total: number;
  };
};

export type SuiteEnd = {
  type: "suiteEnd";
  name: string;
  fullname: string[];
  tests: TestEnd[];
  childSuites: SuiteEnd[];
  defaultStack: string;
  status: Status;
  runtime: number;
  testCounts: {
    passed: number;
    failed: number;
    skipped: number;
    todo: number;
    total: number;
  };
};

export type TestStart = {
  type: "testStart";
  name: string;
  fullname: string[];
  suiteName: string;
  defaultStack: string;
};

export type TestEnd = {
  type: "testEnd";
  name: string;
  fullname: string[];
  suiteName: string;
  defaultStack: string;
  status: Status;
  errors: any[];
  assertions: any[];
  logs: string[];
  runtime: number;
  skipReason: string | undefined;
  slow: boolean;
  memoryUsage: any;
  source?: EventAskSourceContent | null;
};

export type CoreRunnerEvents =
  | RunStart
  | RunEnd
  | SuiteStart
  | SuiteEnd
  | TestStart
  | TestEnd;

export type CoreRunnerEventTypes =
  | "runStart"
  | "runEnd"
  | "otherError"
  | "testStart"
  | "testEnd"
  | "suiteStart"
  | "suiteEnd";

export type ChildEventsEmit = {
  type: "quase-unit-emit";
  eventType: CoreRunnerEventTypes;
  arg: CoreRunnerEvents;
};

export type ChildEvents =
  | ChildEventsEmit
  | {
      type: "quase-unit-source";
      stack: string;
      id: number;
    }
  | {
      type: "quase-unit-why-is-running";
      whyIsRunning: WhyIsRunning;
    }
  | {
      type: "quase-unit-file-imported";
      file: string;
    };

export type EventAskSourceContent = {
  file: string;
  code: string | null | undefined;
  line: number | undefined;
  column: number | undefined;
};

export type RunnerToChildEvents =
  | {
      type: "quase-unit-start";
      options: TestRunnerOptions;
      files: string[];
    }
  | {
      type: "quase-unit-source";
      source: EventAskSourceContent;
      id: number;
    }
  | {
      type: "quase-unit-bail";
    }
  | {
      type: "quase-unit-sigint";
    }
  | {
      type: "quase-unit-ping";
    };

export type MetadataTypes =
  | "test"
  | "before"
  | "after"
  | "beforeEach"
  | "afterEach"
  | "group";

export type GroupMetadata = {
  type: "group";
  serial: boolean;
  exclusive: boolean;
  strict: boolean;
  status: "" | "failing" | "skipped" | "todo";
  allowNoPlan: boolean;
};

export type TestMetadata = {
  type: "test" | "before" | "after" | "beforeEach" | "afterEach";
  serial: boolean;
  exclusive: boolean;
  strict: boolean;
  status: "" | "failing" | "skipped" | "todo";
  bail: boolean;
  allowNoPlan: boolean;
};

export type IRunReturn<T> = PromiseLike<T> | T;

export interface IRunnableResult {
  level: number;
  failedBecauseOfHook: { level: number } | null;
  skipReason: string | undefined;
  status: Status | undefined;
}

export interface GenericRunnable<T extends IRunnableResult> {
  run(ref: ContextRef): IRunReturn<T>;
  runSkip(reason?: string): T;
  runTodo(): T;
}

export interface IRunnable extends GenericRunnable<IRunnableResult> {}

export interface ITestResult extends IRunnableResult {
  metadata: TestMetadata;
  slow: boolean;
  errors: any[];
  assertions: any[];
  logs: string[];
  runtime: number;
}

export interface ITest extends GenericRunnable<ITestResult> {
  clone(): ITest;
}

export type NumOrVoid = number | undefined;

export type PublicTestApi = {
  plan(n: number): void;
  incCount(): void;
  skip(reason?: string): void;
  retries(n: NumOrVoid): void;
  retryDelay(n: NumOrVoid): void;
  reruns(n: NumOrVoid): void;
  rerunDelay(n: NumOrVoid): void;
  timeout(n: NumOrVoid): void;
  slow(n: NumOrVoid): void;
  log(...args: any[]): void;
  matchesSnapshot(something: unknown, key?: string): void;
  context: any;
};

type BaseOptions = {
  files: string[];
  ignore: string[];
  watch: boolean;
  bail: boolean;
  forceSerial: boolean;
  updateSnapshots: boolean;
  timeout: number;
  slow: number;
  only: boolean;
  strict: boolean;
  allowNoPlan: boolean;
  snapshotLocation: string | ((file: string) => string) | undefined;
  env: string | NodeJS.ProcessEnv | undefined;
  diff: boolean;
  stack: boolean;
  codeFrame: boolean;
  codeFrameOptions: any;
  stackIgnore: string | RegExp | undefined;
  color: boolean | undefined;
  timeouts: boolean;
  globalTimeout: number;
  verbose: boolean;
  debug: boolean;
  logHeapUsage: boolean;
  concordanceOptions: any;
};

export type CliOptions = BaseOptions & {
  match: string | string[] | undefined;
  concurrency: NumOrVoid;
  color: boolean | undefined;
  stackIgnore: string | RegExp | undefined;
  random: boolean | string;
  globals: boolean | string[] | undefined;
  reporter: string | undefined;
};

export type NormalizedOptions = BaseOptions & {
  "--": string[];
  configLocation: string | undefined;
  match: string[];
  concurrency: number;
  color: boolean;
  stackIgnore: RegExp | undefined;
  random: string | undefined;
  globals: (string | boolean)[];
  reporter: any;
};

export type TestRunnerOptions = Readonly<{
  ["--"]: string[];
  files: readonly string[]; // @mergeStrategy("override") @description("Glob patterns of files to include");
  ignore: readonly string[]; // @mergeStrategy("concat") @description("Glob patterns of files to ignore");
  match: readonly string[]; // @description("Only run tests with matching title (Can be repeated)");
  watch: boolean; // @description("Watch files for changes and re-run the related tests");
  bail: boolean; // @description("Stop after first test failure");
  forceSerial: boolean; // @description("Run tests serially. It forces --concurrency=1");
  concurrency: number; // @description("Max number of test files running at the same time (Default: CPU logical cores or 2 if running in CI)");
  updateSnapshots: boolean; // @description("Update snapshots");
  globals: readonly string[]; // @description("Specify which global variables can be created by the tests. 'true' for any. Default is 'false'.");
  random: boolean | string | null; // @description("Randomize your tests. Optionally specify a seed or one will be generated");
  timeout: number | null; // @description("Set test timeout");
  slow: number | null; // @description("Set 'slow' test threshold");
  only: boolean; // @description("Only run tests marked with '.only' modifier");
  strict: boolean; // @description("Disallow the usage of 'only', 'failing', 'todo', 'skipped' modifiers");
  allowNoPlan: boolean; // @description("Make tests still succeed if no assertions are run and no planning was done");
  snapshotLocation: (file: string) => string; // @description("Specify a fixed location for storing the snapshot files");
  env: Record<string, unknown>; // @description("The test environment used for all tests. This can point to any file or node module");
  diff: boolean; // @description("Enable/disable diff on failure");
  stack: boolean; // @description("Enable/disable stack trace on failure");
  codeFrame: boolean | Record<string, unknown>; // @description("Enable/disable code frame [and options]");
  stackIgnore: RegExp | null; // @description("Regular expression to ignore some stacktrace files");
  color: boolean | null; // @default("auto") @description("Force or disable. Default: auto detection");
  timeouts: boolean; // @description("Enable/disable test timeouts. Disabled by default with --debug");
  globalTimeout: number; // @default(20000) @description("Global timeout. Zero to disable. Disabled by default with --debug");
  verbose: boolean; // @description("Enable verbose output");
  debug: boolean; // @description("Same as --inspect-brk on nodejs.");
  logHeapUsage: boolean; // @description("Logs the heap usage after every test. Useful to debug memory leaks.");
  concordanceOptions: Record<string, unknown>; // @description("Concordance options.");
  reporter: any; // @description("Specify the reporter to use");
}>;
