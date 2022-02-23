if ( true ) {
  import foo from "./abc";
  import { ay } from "./other";
  export function outer() {
    import { a as ay } from "./abc";
    import { b as bee } from "./abc";
    import { c as see } from "./abc";
    return [ ay, bee, see ];
  }
  if ( false ) {
    foo;
  }
}

foo;
