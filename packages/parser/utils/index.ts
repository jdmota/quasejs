import { type Range } from "../../util/range-utils.ts";
import { type Location } from "../runtime/input.ts";

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

export const EOF_RANGE: Range = { from: -1, to: -1 };

// export const OOB_RANGE: Range = { from: -2, to: -2 };
