export type Result<T, E = unknown> =
  | {
      ok: true;
      value: T;
    }
  | {
      ok: false;
      error: E;
    };

export function ok<T, E = unknown>(value: T): Result<T, E> {
  return { ok: true, value };
}

export function error<T, E>(error: E): Result<T, E> {
  return { ok: false, error };
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
    return !next.ok && prev.error === next.error;
  }
  return false;
}
