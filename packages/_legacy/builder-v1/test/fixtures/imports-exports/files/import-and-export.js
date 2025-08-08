import _default, * as _namespace from "./export1";
import { default as _default2, foo as fooAlias } from "./export2"; /* eslint import/no-named-default: 0 */

export const a = _default;
export const [ b, c ] = [ _namespace.a, _namespace.b ];

const value = _default2;
const e = fooAlias;

export default function() {}
export { value as d, e };
export { f } from "./export2";
export * from "./export3";
export { default as i } from "./export4";
export j from "./export5";
export * as k from "./export6";
