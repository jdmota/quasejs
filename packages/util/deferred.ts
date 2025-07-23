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

class Notifier<T> {
  private defer: Defer<T> | null;

  constructor() {
    this.defer = null;
  }

  done(value: T) {
    const { defer } = this;
    if (defer) {
      this.defer = null;
      defer.resolve(value);
    }
  }

  cancel() {
    const { defer } = this;
    if (defer) {
      this.defer = null;
      defer.reject(new Error("Cancel"));
    }
  }

  isWaiting() {
    return this.defer != null;
  }

  async wait() {
    const defer = (this.defer = createDefer());
    await defer.promise;
    if (this.defer === defer) {
      this.defer = null;
    }
  }
}

export function createNotifier<T>() {
  return new Notifier<T>();
}

export type { Notifier };
