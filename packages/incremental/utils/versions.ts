export type Version = readonly [session: number, version: number];

export function sameVersion(a: Version, b: Version): boolean {
  return a[0] === b[0] && a[1] === b[1];
}
