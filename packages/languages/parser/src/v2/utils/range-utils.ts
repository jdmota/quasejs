export type Range = Readonly<{ from: number; to: number }>;

export function intersect(a: Range, b: Range) {
  return a.from <= b.to && b.from <= a.to;
}

export function allBefore(a: Range, b: Range) {
  return a.to < b.from;
}

export function allAfter(a: Range, b: Range) {
  return b.to < a.from;
}

export function* range(from: number, to: number) {
  for (let i = from; i <= to; i++) {
    yield i;
  }
}

export const EOF_RANGE: Range = { from: -1, to: -1 };

export const IMPOSSIBLE_RANGE: Range = { from: -9, to: -9 };

// export const OOB_RANGE: Range = { from: -2, to: -2 };
