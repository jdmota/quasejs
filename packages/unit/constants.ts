export const HIDDEN = { type: "hidden" } as const;

export const SKIP_BAILED = {
  type: "skipped",
  reason: "Bailed",
} as const;

export const SKIP_INTERRUPTED = {
  type: "skipped",
  reason: "Interrupted",
} as const;

export const SKIP_ABORTED = {
  type: "skipped",
  reason: "Aborted",
} as const;
