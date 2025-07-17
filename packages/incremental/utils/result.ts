export type ComputationResult<T, E = unknown> =
  | {
      readonly ok: true;
      readonly value: T;
    }
  | {
      readonly ok: false;
      readonly error: E;
      readonly deterministic: boolean;
    };

export type VersionedComputationResult<T, E = unknown> = {
  readonly version: number;
  readonly result: ComputationResult<T, E>;
};

export function ok<T, E = unknown>(value: T): ComputationResult<T, E> {
  return { ok: true, value };
}

export function error<T, E>(
  error: E,
  deterministic: boolean
): ComputationResult<T, E> {
  return { ok: false, error, deterministic };
}

export function resultEqual<T>(
  equal: (a: T, b: T) => boolean,
  prev: ComputationResult<T>,
  next: ComputationResult<T>
): boolean {
  if (prev.ok) {
    return next.ok && equal(prev.value, next.value);
  }
  if (!prev.ok) {
    return (
      !next.ok &&
      prev.error === next.error &&
      prev.deterministic === next.deterministic
    );
  }
  return false;
}

export class WrappedResult<T> {
  constructor(readonly result: ComputationResult<T>) {}
}

export function promiseIfOk<T>(promise: Promise<ComputationResult<T>>) {
  return new Promise<T>((resolve, reject) => {
    promise.then(result => {
      if (result.ok) {
        resolve(result.value);
      } else {
        reject(new WrappedResult(result));
      }
    });
  });
}
