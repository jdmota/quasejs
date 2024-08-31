import { createDefer, Defer } from "../../../../util/deferred";
import { never } from "../../../../util/miscellaneous";
import { Result } from "../../../../util/monads";

export type TaskOpts = {
  signal: AbortSignal;
};

export type TaskUserFn<Arg, Ret> = (
  arg: Arg,
  opts: TaskOpts
) => Ret | Promise<Ret>;

export type TaskFn<Arg, Ret> = (
  arg: Arg,
  opts: TaskOpts
) => Promise<Result<Awaited<Ret>, unknown>>;

export interface Task<Arg, Ret> {
  exec(arg: Arg): Promise<TaskResult<Ret>>;
  interrupt(): void;
  kill(): void;
  getState(): TaskState;
  getResult(): TaskResult<Ret> | null;
}

export enum TaskState {
  IDLE,
  RUNNING,
  INTERRUPTING,
  FINISHED,
}

export type TaskResult<Ret> =
  | {
      type: "finished";
      result: Ret;
    }
  | {
      type: "errored";
      error: unknown;
    }
  | {
      type: "cancelled";
    }
  | { type: "killed" };

// Lifecycle:
// IDLE : { result == null, job == null }
// RUNNING : { result == null, job != null }
// INTERRUPTING : { result == null, job != null }
// FINISHED : { result != null }

export class FuncTask<Arg, Ret> implements Task<Arg, Ret> {
  private readonly controller: AbortController;
  private readonly defer: Defer<Ret>;
  private state: TaskState;
  private result: TaskResult<Ret> | null;
  private job: Promise<TaskResult<Ret>> | null;

  constructor(private readonly fn: TaskUserFn<Arg, Ret>) {
    this.controller = new AbortController();
    this.defer = createDefer();
    this.state = TaskState.IDLE;
    this.result = null;
    this.job = null;
  }

  exec(arg: Arg): Promise<TaskResult<Ret>> {
    if (this.result) return Promise.resolve(this.result);
    return this.job ?? (this.job = this.execJob(arg));
  }

  private async execJob(arg: Arg): Promise<TaskResult<Ret>> {
    this.state = TaskState.RUNNING;
    const { fn } = this;
    try {
      const result = await Promise.race([
        fn(arg, { signal: this.controller.signal }),
        this.defer.promise,
      ]);
      return this.finish({
        type: "finished",
        result,
      });
    } catch (error: unknown) {
      return this.finish({
        type: "errored",
        error,
      });
    }
  }

  private finish(result: TaskResult<Ret>) {
    if (this.result) return this.result;
    this.result = result;
    this.state = TaskState.FINISHED;
    return result;
  }

  interrupt() {
    switch (this.state) {
      case TaskState.IDLE:
        this.finish({
          type: "cancelled",
        });
        break;
      case TaskState.RUNNING:
        this.state = TaskState.INTERRUPTING;
        this.controller.abort();
        break;
      case TaskState.INTERRUPTING:
      case TaskState.FINISHED:
        break;
      default:
        never(this.state);
    }
  }

  kill() {
    switch (this.state) {
      case TaskState.IDLE:
        this.finish({
          type: "cancelled",
        });
        break;
      case TaskState.RUNNING:
      case TaskState.INTERRUPTING:
        this.finish({
          type: "killed",
        });
        this.controller.abort();
        this.defer.reject(new Error("killed"));
        break;
      case TaskState.FINISHED:
        break;
      default:
        never(this.state);
    }
  }

  getState() {
    return this.state;
  }

  getResult() {
    return this.result;
  }
}

export function createTask<Arg, Ret>(
  fn: TaskUserFn<Arg, Ret>
): TaskFn<Arg, Ret> {
  return async (arg: Arg, opts: TaskOpts) => {
    const { signal } = opts;
    if (signal.aborted) {
      return Result.error(signal.reason);
    }
    try {
      const result = await fn(arg, opts);
      return Result.ok(result);
    } catch (error: unknown) {
      return Result.error(error);
    }
  };
}

// Inspired in https://jsr.io/@std/async

export async function abortable<T>(
  p: Promise<T>,
  signal: AbortSignal
): Promise<T> {
  if (signal.aborted) return Promise.reject(signal.reason);
  const { promise, reject } = createDefer<T>();
  const abort = () => reject(signal.reason);
  signal.addEventListener("abort", abort, { once: true });
  try {
    return await Promise.race([promise, p]);
  } finally {
    signal.removeEventListener("abort", abort);
  }
}

export type DeadlineOptions = {
  signal?: AbortSignal | null;
};

export async function deadline<T>(
  p: Promise<T>,
  ms: number,
  options: DeadlineOptions = {}
): Promise<T> {
  const signals = [AbortSignal.timeout(ms)];
  if (options.signal) signals.push(options.signal);
  return await abortable(p, AbortSignal.any(signals));
}

export type DelayOptions = {
  signal?: AbortSignal | null;
};

export function delay(ms: number, options: DelayOptions = {}): Promise<void> {
  const { signal } = options;
  if (signal?.aborted) return Promise.reject(signal.reason);
  return new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(i);
      reject(signal?.reason);
    };
    const done = () => {
      signal?.removeEventListener("abort", abort);
      resolve();
    };
    const i = setTimeout(done, ms);
    signal?.addEventListener("abort", abort, { once: true });
  });
}

export class RetryError extends Error {
  constructor(cause: unknown, attempts: number) {
    super(`Retrying exceeded the maxAttempts (${attempts}).`);
    this.name = "RetryError";
    this.cause = cause;
  }
}

export type RetryOptions = {
  signal?: AbortSignal | null;
  multiplier?: number;
  maxTimeout?: number;
  maxAttempts?: number;
  minTimeout?: number;
  jitter?: number;
};

const defaultRetryOptions: Required<RetryOptions> = {
  signal: null,
  multiplier: 2,
  maxTimeout: 60000,
  maxAttempts: 5,
  minTimeout: 1000,
  jitter: 1,
};

export async function retry<T>(
  fn: (() => Promise<T>) | (() => T),
  opts?: RetryOptions
): Promise<T> {
  const options: Required<RetryOptions> = {
    ...defaultRetryOptions,
    ...opts,
  };

  if (options.maxTimeout <= 0) {
    throw new TypeError(
      `Cannot retry as 'maxTimeout' must be positive: current value is ${options.maxTimeout}`
    );
  }
  if (options.minTimeout > options.maxTimeout) {
    throw new TypeError(
      `Cannot retry as 'minTimeout' must be <= 'maxTimeout': current values 'minTimeout=${options.minTimeout}', 'maxTimeout=${options.maxTimeout}'`
    );
  }
  if (options.jitter > 1) {
    throw new TypeError(
      `Cannot retry as 'jitter' must be <= 1: current value is ${options.jitter}`
    );
  }

  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (error) {
      if (attempt + 1 >= options.maxAttempts) {
        throw new RetryError(error, options.maxAttempts);
      }

      const timeout = exponentialBackoffWithJitter(
        options.maxTimeout,
        options.minTimeout,
        attempt,
        options.multiplier,
        options.jitter
      );
      await delay(timeout, { signal: options.signal });
    }
    attempt++;
  }
}

export function exponentialBackoffWithJitter(
  cap: number,
  base: number,
  attempt: number,
  multiplier: number,
  jitter: number
) {
  const exp = Math.min(cap, base * multiplier ** attempt);
  return (1 - jitter * Math.random()) * exp;
}
