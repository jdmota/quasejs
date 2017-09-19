import foo from "foo";
import { default as foo2 } from "foo";

foo;
foo2.bar;
foo2.bar.baz;

function a() {
  let foo = 10;
  foo;
}
