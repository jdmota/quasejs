import { setAdd } from "./maps-sets";

export type Optional<T> = T | undefined | null;

export type Obj = { readonly [key: string]: unknown };

export type ObjRecord<K extends PropertyKey, V> = {
  [P in K]?: V | undefined;
};

export function isObject(o: unknown): o is {} {
  return o != null && typeof o === "object";
}

export function noop() {}

export function assertion(bool: boolean) {
  if (!bool) {
    throw new Error("Assertion error");
  }
}

export function never(_: never): never {
  throw new Error("Never");
}

export function expect<T>(_: T) {}

export function expectType<Expected, Actual extends Expected>() {}

export function unreachable(): never {
  throw new Error("Assertion error");
}

export function nonNull<T>(val: Optional<T>): T {
  if (val == null) {
    throw new Error("Value is " + val);
  }
  return val;
}

export function arrify<T>(val: Optional<T | T[]>): T[] {
  if (val == null) {
    return [];
  }
  return Array.isArray(val) ? val : [val];
}

export interface ObjectHashEquals {
  hashCode(): number;
  equals(other: unknown): boolean;
}

export function equals(a: ObjectHashEquals | null, b: ObjectHashEquals | null) {
  if (a === null || b === null) return a === b;
  return a.equals(b);
}

export function strictArrayEquals<T>(
  a: readonly T[],
  b: readonly T[]
): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

export function arrayEquals<T>(
  a: readonly T[],
  b: readonly T[],
  equals: (a: T, b: T) => boolean
): boolean {
  return a.length === b.length && a.every((v, i) => equals(v, b[i]));
}

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

export function first<T>(it: Iterable<T>, defaultt: T | null = null): T {
  for (const value of it) {
    return value;
  }
  if (defaultt == null) {
    throw new Error("Iterable has zero elements");
  }
  return defaultt;
}

export function lines(
  arr: readonly (string | undefined)[],
  separator = "\n"
): string {
  return arr.filter(Boolean).join(separator);
}

export const defaultSet = <T>() => new Set<T>();

export { setAdd };

export function computeIfAbsent<K, V>(map: Map<K, V>, key: K, fn: () => V): V {
  let value = map.get(key);
  if (value === undefined) {
    value = fn();
    map.set(key, value);
  }
  return value;
}

// From https://github.com/sindresorhus/type-fest/blob/main/source/opaque.d.ts

declare const tag: unique symbol;

export type TagContainer<Token> = {
  readonly [tag]: Token;
};

type Tag<Token extends PropertyKey, TagMetadata> = TagContainer<{
  [K in Token]: TagMetadata;
}>;

export type Opaque<
  Type,
  TagName extends PropertyKey,
  TagMetadata = never,
> = Type & Tag<TagName, TagMetadata>;

export type Class<T, Arguments extends unknown[] = any[]> = {
  prototype: Pick<T, keyof T>;
  new (...args: Arguments): T;
};
