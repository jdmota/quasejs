import { createDefer } from "./deferred";

export function sleep(n: number) {
  return new Promise<void>(resolve => setTimeout(resolve, n));
}

// Adapted from https://jsr.io/@std/async

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
