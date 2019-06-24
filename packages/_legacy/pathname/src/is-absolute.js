import { assertPath, SLASH_CODE, BACK_SLASH_CODE } from "./vars";

// Assume that `p` is a string
export function isAbs( p ) {
  const c = p.charCodeAt( 0 );
  return c === SLASH_CODE || c === BACK_SLASH_CODE;
}

export default function( p ) {
  assertPath( p );
  return isAbs( p );
}
