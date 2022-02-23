if ( true ) import { a as x } from "./abc";
if ( false ) import { b as y } from "./abc";

if ( true ) export function outer() {
  import { a as ay } from "./abc";
  import { b as bee } from "./abc";
  import { c as see } from "./abc";
  return [ ay, bee, see ];
}

if ( false ) export { x } from "./foo";

x; // Stay as x
y; // Stay as y
