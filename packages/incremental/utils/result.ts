export type Result<T, E = unknown> =
  | {
      ok: true;
      value: T;
    }
  | {
      ok: false;
      error: E;
      deterministic: boolean;
    };

export function ok<T, E = unknown>(value: T): Result<T, E> {
  return { ok: true, value };
}

export function error<T, E>(error: E, deterministic: boolean): Result<T, E> {
  return { ok: false, error, deterministic };
}

export function resultEqual<T>(
  equal: (a: T, b: T) => boolean,
  prev: Result<T>,
  next: Result<T>
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
