import { getStack } from "../error/index";
import { type Optional } from "../util/miscellaneous";
import { is32bitInteger } from "./random";
import type { RunningContext } from "./runnable";

export type RunnableOpts = Readonly<{
  strict: boolean;
  runOnly: boolean;
  filter: Optional<string>;
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
  filter: null,
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
  updateSnapshots: false,
  snapshotLocation: null, // TODO use and custom serializer?
  sanitize: {
    globals: [],
    handles: true,
    exit: true,
    warnings: true,
  },
};

export class RunnableBuilder {
  constructor(
    public readonly opts: RunnableOpts,
    private readonly runnerTests: { ref: RunnableDesc[] | null }
  ) {}

  strict(strict: boolean) {
    if (this.opts.strict && !strict) {
      throw new Error("Strict mode cannot be disabled after being enabled");
    }
    return new RunnableBuilder(
      {
        ...this.opts,
        strict,
        filter: null,
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

  filter(filter: Optional<string>) {
    if (this.opts.strict && filter != null) {
      throw new Error("In strict mode");
    }
    return new RunnableBuilder(
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
    return new RunnableBuilder(
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
    return new RunnableBuilder(
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
    return new RunnableBuilder(
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
    return new RunnableBuilder(
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
    return new RunnableBuilder(
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
    return new RunnableBuilder(
      {
        ...this.opts,
        updateSnapshots,
      },
      this.runnerTests
    );
  }

  if(_if: boolean) {
    return new RunnableBuilder(
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
    return new RunnableBuilder(
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
    return new RunnableBuilder(
      {
        ...this.opts,
        concurrency,
      },
      this.runnerTests
    );
  }

  signal(signal: AbortSignal | null) {
    return new RunnableBuilder(
      {
        ...this.opts,
        signal,
      },
      this.runnerTests
    );
  }

  plan(plan: number | null) {
    return new RunnableBuilder(
      {
        ...this.opts,
        plan,
      },
      this.runnerTests
    );
  }

  retries(retries: number, retryDelay: number = 0) {
    return new RunnableBuilder(
      {
        ...this.opts,
        retries,
        retryDelay,
      },
      this.runnerTests
    );
  }

  reruns(reruns: number, rerunDelay: number = 0) {
    return new RunnableBuilder(
      {
        ...this.opts,
        reruns,
        rerunDelay,
      },
      this.runnerTests
    );
  }

  timeout(timeout: number | null) {
    return new RunnableBuilder(
      {
        ...this.opts,
        timeout,
      },
      this.runnerTests
    );
  }

  slow(slow: number | null) {
    return new RunnableBuilder(
      {
        ...this.opts,
        slow,
      },
      this.runnerTests
    );
  }

  logHeapUsage(logHeapUsage: boolean) {
    return new RunnableBuilder(
      {
        ...this.opts,
        logHeapUsage,
      },
      this.runnerTests
    );
  }

  snapshotLocation(snapshotLocation: string | null) {
    return new RunnableBuilder(
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
    return new RunnableBuilder(
      {
        ...this.opts,
        random,
      },
      this.runnerTests
    );
  }

  sanitize(opts: Partial<RunnableOpts["sanitize"]>) {
    return new RunnableBuilder(
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
    fn: (ctx: RunningContext) => Promise<void> | void,
    _internal?: boolean
  ): RunnableDesc;
  test(title: any, fn?: any, _internal: boolean = false) {
    if (typeof title === "function") {
      fn = title;
      title = "";
    }
    const desc = new RunnableDesc(
      title,
      fn,
      this.opts,
      getStack(_internal ? 3 : 2)
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
