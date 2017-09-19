function a() {
  import { a as x } from "./abc";
}

function b() {
  export function outer() {
    import { a as ay } from "./abc";
    import { b as bee } from "./abc";
    import { c as see } from "./abc";
    return [ ay, bee, see ];
  }
}

x; // Stay as x
y; // Stay as y
