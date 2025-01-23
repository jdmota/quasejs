export type ComputationResult<T, E = unknown> =
  | {
      ok: true;
      value: T;
    }
  | {
      ok: false;
      error: E;
      deterministic: boolean;
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

const noop = () => {};

export function promiseIfOk<T>(promise: Promise<ComputationResult<T>>) {
  return new Promise<T>(resolve => {
    promise.then(result => {
      if (result.ok) {
        resolve(result.value);
      }
    }, noop);
  });
}
