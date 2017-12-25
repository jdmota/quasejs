// @flow
import type { Loc } from "../types";

export function locToString( loc: ?Loc ): string {
  if ( loc ) {
    if ( loc.column != null ) {
      return `${loc.line}:${loc.column}`;
    }
    return `${loc.line}`;
  }
  return "";
}
