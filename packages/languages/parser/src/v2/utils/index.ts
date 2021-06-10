import type { Location } from "../runtime/input";

export function printLoc(loc: Location) {
  return `${loc.start.line}:${loc.start.column}-${loc.end.line}:${loc.end.column}`;
}

export function locSuffix(loc: Location | null) {
  return loc ? ` (at ${printLoc(loc)})` : "";
}

export function never(_: never): never {
  throw new Error("Never");
}

export function expect<T>(_: T) {}

export function first<T>(it: Iterable<T>): T {
  for (const value of it) {
    return value;
  }
  throw new Error("Iterable has zero elements");
}
