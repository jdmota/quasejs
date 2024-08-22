import { getCallSite } from "../../../../error/src/index";
import { Optional } from "../../../../util/miscellaneous";
import { is32bitInteger } from "./random";
import { RunningContext } from "./runnable";

const TRUE_FN = () => true;

export type RunnableOpts = Readonly<{
  strict: boolean;
  runOnly: boolean;
  filter: (title: string) => boolean;
  signal: Optional<AbortSignal>;
  plan: Optional<number>;
  only: boolean;
  skip: boolean;
  skipReason: Optional<string>;
  todo: boolean;
  todoDesc: Optional<string>;
  if: boolean;
  failing: boolean;
  bail: number;
  retries: number;
  retryDelay: number;
  reruns: number;
  rerunDelay: number;
  timeout: Optional<number>;
  slow: Optional<number>;
  logHeapUsage: boolean;
  concurrency: number;
  random: boolean | number;
  updateSnapshots: boolean;
  snapshotLocation: Optional<string>;
  sanitize: Readonly<{
    globals: boolean | readonly string[];
    handles: boolean;
    exit: boolean;
    warnings: boolean;
  }>;
}>;

export const defaultOpts: RunnableOpts = {
  strict: false,
  runOnly: false,
  filter: TRUE_FN,
  signal: null,
  plan: null,
  only: false,
  skip: false,
  skipReason: null,
  todo: false,
  todoDesc: null,
  if: true,
  failing: false,
  timeout: null,
  slow: null,
  logHeapUsage: false,
  bail: Infinity,
  concurrency: 1,
  random: false,
  retries: 0, // TODO use
  retryDelay: 0, // TODO use
  reruns: 0, // TODO use
  rerunDelay: 0, // TODO use
  updateSnapshots: false, // TODO use
  snapshotLocation: null, // TODO use
  sanitize: {
    globals: [],
    handles: true,
    exit: true,
    warnings: true,
  },
};

export class RunnableCtx {
  constructor(
    public readonly opts: RunnableOpts,
    private readonly runnerTests: { ref: RunnableDesc[] | null }
  ) {}

  strict(strict: boolean) {
    if (this.opts.strict && !strict) {
      throw new Error("Strict mode cannot be disabled after being enabled");
    }
    return new RunnableCtx(
      {
        ...this.opts,
        strict,
        filter: TRUE_FN,
        runOnly: false,
        only: false,
        failing: false,
        skip: false,
        skipReason: null,
        todo: false,
        todoDesc: null,
        updateSnapshots: false,
      },
      this.runnerTests
    );
  }

  filter(filter: (title: string) => boolean) {
    if (this.opts.strict && filter !== TRUE_FN) {
      throw new Error("In strict mode");
    }
    return new RunnableCtx(
      {
        ...this.opts,
        filter,
      },
      this.runnerTests
    );
  }

  runOnly(runOnly: boolean) {
    if (this.opts.strict && runOnly) {
      throw new Error("In strict mode");
    }
    return new RunnableCtx(
      {
        ...this.opts,
        runOnly,
      },
      this.runnerTests
    );
  }

  only(only: boolean) {
    if (this.opts.strict && only) {
      throw new Error("In strict mode");
    }
    return new RunnableCtx(
      {
        ...this.opts,
        only,
      },
      this.runnerTests
    );
  }

  failing(failing: boolean) {
    if (this.opts.strict && failing) {
      throw new Error("In strict mode");
    }
    return new RunnableCtx(
      {
        ...this.opts,
        failing,
      },
      this.runnerTests
    );
  }

  skip(skip: boolean, skipReason?: string) {
    if (this.opts.strict && skip) {
      throw new Error("In strict mode");
    }
    return new RunnableCtx(
      {
        ...this.opts,
        skip,
        skipReason,
      },
      this.runnerTests
    );
  }

  todo(todo: boolean, todoDesc?: string) {
    if (this.opts.strict && todo) {
      throw new Error("In strict mode");
    }
    return new RunnableCtx(
      {
        ...this.opts,
        todo: true,
        todoDesc,
      },
      this.runnerTests
    );
  }

  updateSnapshots(updateSnapshots: boolean) {
    if (this.opts.strict && updateSnapshots) {
      throw new Error("In strict mode");
    }
    return new RunnableCtx(
      {
        ...this.opts,
        updateSnapshots,
      },
      this.runnerTests
    );
  }

  if(_if: boolean) {
    return new RunnableCtx(
      {
        ...this.opts,
        if: _if,
      },
      this.runnerTests
    );
  }

  bail(b: number | boolean) {
    let bail;
    if (b === false) {
      bail = Infinity;
    } else if (b === true) {
      bail = 1;
    } else {
      bail = Math.max(b, 1);
    }
    return new RunnableCtx(
      {
        ...this.opts,
        bail,
      },
      this.runnerTests
    );
  }

  concurrency(c: number | boolean) {
    let concurrency;
    if (c === true) {
      concurrency = Infinity;
    } else if (c === false) {
      concurrency = 1;
    } else {
      concurrency = Math.max(c, 1);
    }
    return new RunnableCtx(
      {
        ...this.opts,
        concurrency,
      },
      this.runnerTests
    );
  }

  signal(signal: AbortSignal | null) {
    return new RunnableCtx(
      {
        ...this.opts,
        signal,
      },
      this.runnerTests
    );
  }

  plan(plan: number | null) {
    return new RunnableCtx(
      {
        ...this.opts,
        plan,
      },
      this.runnerTests
    );
  }

  retries(retries: number, retryDelay: number = 0) {
    return new RunnableCtx(
      {
        ...this.opts,
        retries,
        retryDelay,
      },
      this.runnerTests
    );
  }

  reruns(reruns: number, rerunDelay: number = 0) {
    return new RunnableCtx(
      {
        ...this.opts,
        reruns,
        rerunDelay,
      },
      this.runnerTests
    );
  }

  timeout(timeout: number | null) {
    return new RunnableCtx(
      {
        ...this.opts,
        timeout,
      },
      this.runnerTests
    );
  }

  slow(slow: number | null) {
    return new RunnableCtx(
      {
        ...this.opts,
        slow,
      },
      this.runnerTests
    );
  }

  logHeapUsage(logHeapUsage: boolean) {
    return new RunnableCtx(
      {
        ...this.opts,
        logHeapUsage,
      },
      this.runnerTests
    );
  }

  snapshotLocation(snapshotLocation: string | null) {
    return new RunnableCtx(
      {
        ...this.opts,
        snapshotLocation,
      },
      this.runnerTests
    );
  }

  random(random: boolean | number) {
    if (typeof random === "number" && !is32bitInteger(random)) {
      throw new Error("Invalid random seed. Expected 32-bit integer.");
    }
    return new RunnableCtx(
      {
        ...this.opts,
        random,
      },
      this.runnerTests
    );
  }

  sanitize(opts: Partial<RunnableOpts["sanitize"]>) {
    return new RunnableCtx(
      {
        ...this.opts,
        sanitize: { ...this.opts.sanitize, ...opts },
      },
      this.runnerTests
    );
  }

  test(fn: (ctx: RunningContext) => Promise<void> | void): RunnableDesc;
  test(
    title: string,
    fn: (ctx: RunningContext) => Promise<void> | void
  ): RunnableDesc;
  test(title: any, fn?: any) {
    if (typeof title === "function") {
      fn = title;
      title = "";
    }
    const desc = new RunnableDesc(
      title,
      fn,
      this.opts,
      getCallSite(1).toString()
    );
    this.runnerTests.ref?.push(desc);
    return desc;
  }
}

export class RunnableDesc {
  constructor(
    readonly title: string,
    readonly fn: (ctx: RunningContext) => Promise<void> | void,
    readonly opts: RunnableOpts,
    readonly stack: string
  ) {}
}
