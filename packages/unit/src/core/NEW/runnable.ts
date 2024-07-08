import { Optional } from "../../../../util/miscellaneous";

export type SimpleError = {
  name: string;
  message: string;
  stack: string;
};

export type RunnableResult =
  | Readonly<{
      type: "passed";
      duration: number;
    }>
  | Readonly<{
      type: "failing";
      errors: readonly SimpleError[];
      duration: number;
    }>
  | Readonly<{
      type: "skipped";
      reason: string | undefined;
    }>
  | Readonly<{
      type: "todo";
      description: string | undefined;
    }>;

export type RunnableStatus = RunnableResult["type"];

const TRUE_FN = () => true;

// TODO study how options are propagated to children...
export class RunnableCtx {
  private _strict = false; // Propagate
  private _runOnly = false; // Propagate
  private _filter: (title: string) => boolean = TRUE_FN; // Propagate
  private _signal: Optional<AbortSignal> = null;
  private _plan: Optional<boolean | number> = null; // Propagate "no plan" ???
  private _only = false; // Propagate???
  private _skip = false;
  private _skipReason: Optional<string> = null;
  private _todo = false;
  private _todoDesc: Optional<string> = null;
  private _if = true;
  private _failing = false;
  private _bail: Optional<number> = null; // Propagate???
  private _retries = 0;
  private _retryDelay = 0;
  private _reruns = 0;
  private _rerunDelay = 0;
  private _timeout: Optional<number> = null;
  private _slow: Optional<number> = null; // Propagate???
  private _maxHeapUsage: Optional<number> = null; // Propagate???
  private _concurrency = 1; // Propagate???
  private _random: Optional<boolean | string> = null; // Propagate???
  private _updateSnapshots = false; // Propagate
  private _snapshotLocation: Optional<string> = null; // Propagate
  private _coverage = false; // Propagate
  // Propagate
  private _sanitize: Readonly<{
    globals: boolean | readonly string[];
    resources: boolean;
    operations: boolean;
    exit: boolean;
    deprecated: boolean;
  }> = {
    globals: true,
    resources: true,
    operations: true,
    exit: true,
    deprecated: true,
  };
  // Propagate
  private _errorOpts: Readonly<{
    diff: boolean;
    codeFrame: boolean;
    stack: boolean;
    stackIgnore: Optional<string | RegExp>;
  }> = {
    diff: true,
    codeFrame: true,
    stack: true,
    stackIgnore: null,
  };

  clone() {
    const ctx = new RunnableCtx();
    for (const [key, value] of Object.entries(ctx)) {
      //@ts-ignore
      ctx[key] = value;
    }
    ctx._sanitize = { ...ctx._sanitize };
    ctx._errorOpts = { ...ctx._errorOpts };
    return ctx;
  }

  strict(s: boolean) {
    this._strict = s;
  }

  runOnly(only: boolean) {
    this._runOnly = only;
  }

  filter(fn: (title: string) => boolean) {
    this._filter = fn;
  }

  concurrency(c: number | boolean) {
    if (c === true) {
      this._concurrency = Infinity;
    } else if (c === false) {
      this._concurrency = 1;
    } else {
      this._concurrency = c;
    }
  }

  signal(signal: AbortSignal | null) {
    this._signal = signal;
  }

  //

  plan(n: number | null) {
    this._plan = n;
  }

  //

  only(o: boolean) {
    this._only = o;
  }

  bail(n: number | null) {
    this._bail = n;
  }

  failing(f: boolean) {
    this._failing = f;
  }

  skip(reason?: string) {
    this._skip = true;
    this._skipReason = reason;
  }

  todo(description?: string) {
    this._todo = true;
    this._todoDesc = description;
  }

  if(b: boolean) {
    this._if = b;
  }

  skipIf(b: boolean, reason?: string) {
    if (b) {
      this.skip(reason);
    }
  }

  todoIf(b: boolean, description?: string) {
    if (b) {
      this.todo(description);
    }
  }

  //

  retries(n: number, delay?: number) {
    this._retries = n;
    this._retryDelay = delay ?? 0;
  }

  reruns(n: number, delay?: number) {
    this._reruns = n;
    this._rerunDelay = delay ?? 0;
  }

  //

  timeout(n: number | null) {
    this._timeout = n;
  }

  slow(n: number | null) {
    this._slow = n;
  }

  maxHeapUsage(n: number | null) {
    this._maxHeapUsage = n;
  }

  //

  updateSnapshots(u: boolean) {
    this._updateSnapshots = u;
  }

  snapshotLocation(loc: string | null) {
    this._snapshotLocation = loc;
  }

  //

  beforeAll() {}
  afterAll() {}
  afterAllAlways() {}
  beforeEach() {}
  afterEach() {}
  afterEachAlways() {}

  //

  random(r: boolean | string | null) {
    this._random = r;
  }

  //

  coverage(c: boolean) {
    this._coverage = c;
  }

  //

  sanitize(opts: {
    globals?: boolean | readonly string[];
    resources?: boolean;
    operations?: boolean;
    exit?: boolean;
    deprecated?: boolean;
  }) {
    this._sanitize = { ...this._sanitize, ...opts };
  }

  errorOpts(opts: {
    diff?: boolean;
    codeFrame?: boolean;
    stack?: boolean;
    stackIgnore?: string | RegExp | null;
  }) {
    this._errorOpts = { ...this._errorOpts, ...opts };
  }
}

export class TestApiCtx {
  incAssertionCount() {}
  matchesSnapshot(something: unknown, key?: string) {}
  log(...args: any[]) {}
}

export class Runnable {
  nesting: number;

  run(): RunnableResult {}

  runSkip(reason: string | undefined): RunnableResult {}

  runTodo(description: string | undefined): RunnableResult {}
}
