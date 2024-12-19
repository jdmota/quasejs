// Assumes that there are no circular references
export function jsonEquals(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a)) {
    return (
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((v, i) => jsonEquals(v, b[i]))
    );
  }
  if (typeof a === "object" && typeof b === "object") {
    if (a == null) return b == null;
    if (b == null) return a == null;
    const aEntries = Object.entries(a);
    const bEntries = Object.entries(b);
    return (
      aEntries.length === bEntries.length &&
      aEntries.every(
        ([key, val], i) =>
          key === bEntries[i][0] && jsonEquals(val, bEntries[i][1])
      )
    );
  }
  return false;
}

// Assumes that there are no circular references
export function jsonHashCode(a: unknown): number {
  if (Array.isArray(a)) {
    return a.length;
  }
  if (typeof a === "object") {
    if (a == null) return 0;
    const aKeys = Object.keys(a);
    return 2 * aKeys.length;
  }
  return (typeof a).length;
}
