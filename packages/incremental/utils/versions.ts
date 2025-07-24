export type InDiskVersion = readonly [session: number, version: number];

export type RuntimeVersion = readonly [session: number | null, version: number];

export type Version = InDiskVersion | RuntimeVersion;

export function sameVersion(a: Version, b: Version): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

export function addSessionId(
  [session, version]: Version,
  theSession: number
): InDiskVersion {
  return [session == null ? theSession : session, version];
}
