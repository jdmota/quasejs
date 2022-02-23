export function isObject(obj: unknown): obj is object {
  return typeof obj === "object" && obj != null;
}

export function typeOf(obj: unknown) {
  return obj === null ? "null" : typeof obj;
}

export function identity<T>(x: T) {
  return x;
}

export function ifNullUndef<T>(x: T | null | undefined): T | undefined {
  return x == null ? undefined : x;
}
