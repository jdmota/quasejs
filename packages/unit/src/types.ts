import { ContextRef } from "./core/context";

export type Deferred<T> = {
  promise: Promise<T>;
  resolve: ( x: T ) => void;
  reject: ( err: Error ) => void;
};

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

export type CoreRunnerEvents = RunStart | RunEnd | SuiteStart | SuiteEnd | TestStart | TestEnd;

export type CoreRunnerEventTypes = "runStart" | "runEnd" | "otherError" | "testStart" | "testEnd" | "suiteStart" | "suiteEnd";

export type ChildEventsEmit = {
  type: "quase-unit-emit";
  eventType: CoreRunnerEventTypes;
  arg: CoreRunnerEvents;
};

export type ChildEvents = ChildEventsEmit | {
  type: "quase-unit-source";
  stack: string;
  id: number;
} | {
  type: "quase-unit-why-is-running";
  whyIsRunning: WhyIsRunning;
} | {
  type: "quase-unit-file-imported";
  file: string;
};

export type EventAskSourceContent = {
  file: string;
  code: string | null | undefined;
  line: number | undefined;
  column: number | undefined;
};

export type RunnerToChildEvents = {
  type: "quase-unit-start";
  options: NormalizedOptions;
  files: string[];
} | {
  type: "quase-unit-source";
  source: EventAskSourceContent;
  id: number;
} | {
  type: "quase-unit-bail";
} | {
  type: "quase-unit-sigint";
} | {
  type: "quase-unit-ping";
};

export type MetadataTypes = "test" | "before" | "after" | "beforeEach" | "afterEach" | "group";

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
  run( ref: ContextRef ): IRunReturn<T>;
  runSkip( reason?: string ): T;
  runTodo(): T;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
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
  plan( n: number ): void;
  incCount(): void;
  skip( reason?: string ): void;
  retries( n: NumOrVoid ): void;
  retryDelay( n: NumOrVoid ): void;
  reruns( n: NumOrVoid ): void;
  rerunDelay( n: NumOrVoid ): void;
  timeout( n: NumOrVoid ): void;
  slow( n: NumOrVoid ): void;
  log( ...args: any[] ): void;
  matchesSnapshot( something: unknown, key?: string ): void;
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
  snapshotLocation: string | ( ( file: string ) => string ) | undefined;
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
  globals: ( string | boolean )[];
  reporter: any;
};
