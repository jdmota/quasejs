export type Defer<T> = {
  readonly isFulfilled: () => boolean;
  readonly resolve: (value: T | PromiseLike<T>) => void;
  readonly reject: (error: Error) => void;
  readonly promise: Promise<T>;
};

export function createDefer<T>(): Defer<T> {
  let fulfilled = false;
  let resolve: (value: T | PromiseLike<T>) => void;
  let reject: (error: Error) => void;
  const promise = new Promise<T>((a, b) => {
    resolve = a;
    reject = b;
  });
  return {
    isFulfilled() {
      return fulfilled;
    },
    resolve(value) {
      fulfilled = true;
      resolve(value);
    },
    reject(value) {
      fulfilled = true;
      reject(value);
    },
    promise,
  };
}

export type ErrorDefer = {
  readonly isFulfilled: () => boolean;
  readonly reject: (error: Error) => void;
  readonly promise: Promise<never>;
};

export function createErrorDefer(): ErrorDefer {
  return createDefer();
}
