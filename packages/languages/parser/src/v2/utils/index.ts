import type { Location } from "../runtime/input";

export interface ObjectHashEquals {
  hashCode(): number;
  equals(other: unknown): boolean;
}

export function equals(a: ObjectHashEquals | null, b: ObjectHashEquals | null) {
  if (a === null || b === null) return a === b;
  return a.equals(b);
}

export type Optional<T> = T | undefined | null;

export function find<A, B>(
  it: Iterable<A>,
  fn: (val: A) => B | null
): B | null {
  for (const val of it) {
    const val2 = fn(val);
    if (val2 != null) return val2;
  }
  return null;
}

export function any<T>(it: Iterable<T>, fn: (val: T) => boolean): boolean {
  for (const val of it) {
    if (fn(val)) return true;
  }
  return false;
}

export function all<T>(it: Iterable<T>, fn: (val: T) => boolean): boolean {
  for (const val of it) {
    if (!fn(val)) return false;
  }
  return true;
}

export function printLoc(loc: Location) {
  return `${loc.start.line}:${loc.start.column}-${loc.end.line}:${loc.end.column}`;
}

export function locSuffix(loc: Location | undefined | null) {
  return loc ? ` at ${printLoc(loc)}` : "";
}

export function locSuffix2(
  loc1: Location | undefined | null,
  loc2: Location | undefined | null
) {
  return loc1 && loc2 ? ` at ${printLoc(loc1)} and ${printLoc(loc2)}` : "";
}

export function never(_: never): never {
  throw new Error("Never");
}

export function expect<T>(_: T) {}

export function first<T>(it: Iterable<T>, defaultt: T | null = null): T {
  for (const value of it) {
    return value;
  }
  if (defaultt == null) {
    throw new Error("Iterable has zero elements");
  }
  return defaultt;
}

export function assertion(bool: boolean) {
  if (!bool) {
    throw new Error("Assertion error");
  }
}

export function nonNull<T>(val: T | undefined | null): T {
  if (val == null) {
    throw new Error("Value is null");
  }
  return val;
}

export function lines(
  arr: readonly (string | undefined)[],
  separator = "\n"
): string {
  return arr.filter(Boolean).join(separator);
}

export function computeIfAbsent<K, V>(map: Map<K, V>, key: K, fn: () => V): V {
  let value = map.get(key);
  if (value === undefined) {
    value = fn();
    map.set(key, value);
  }
  return value;
}
