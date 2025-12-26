export type Version = readonly [session: number, version: number];

export function sameVersion(a: Version, b: Version): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

export function olderVersion(a: Version, b: Version): Version {
  if (a[0] < b[0]) return a;
  if (b[0] < a[0]) return b;
  if (a[1] < b[1]) return a;
  return b;
}
