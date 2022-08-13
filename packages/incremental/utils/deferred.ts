export type Defer<T> = {
  readonly resolve: (value: T | PromiseLike<T>) => void;
  readonly reject: (error: Error) => void;
  readonly promise: Promise<T>;
};

export function createDefer<T>(): Defer<T> {
  let resolve, reject;
  const promise = new Promise<T>((a, b) => {
    resolve = a;
    reject = b;
  });
  return {
    //@ts-ignore
    resolve,
    //@ts-ignore
    reject,
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

  wait() {
    return (this.defer = createDefer()).promise;
  }
}

export function createNotifier<T>() {
  return new Notifier<T>();
}

export type { Notifier };
