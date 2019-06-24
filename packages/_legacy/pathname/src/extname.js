import { assertPath } from "./vars";

const reExt = /([^\\/]*)(\.[^.\\/]*)$/;
const reTrailing = /[\\/]+$/;

export default function( pathname ) {
  assertPath( pathname );
  const m = pathname.replace( reTrailing, "" ).match( reExt );
  return m && m[ 2 ] && m[ 1 ] ? m[ 2 ] : "";
}
