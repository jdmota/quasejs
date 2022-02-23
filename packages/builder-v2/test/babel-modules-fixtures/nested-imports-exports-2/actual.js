switch ( true ) {
  case 0:
    import foo from "./abc";
    break;
  case true:
    export function outer() {
      import { a as ay } from "./abc";
      import { b as bee } from "./abc";
      import { c as see } from "./abc";
      return [ ay, bee, see ];
    }
    break;
  case false:
    import abc from "./abc";
  default:
    foo;
    export default null;
}

foo;
