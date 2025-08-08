import foo from "foo";
import { default as foo2 } from "foo";
import bar from "bar";

<foo></foo>;
<foo2.bar></foo2.bar>;
<foo2.bar.baz></foo2.bar.baz>;
<foo2.bar.baz.foo></foo2.bar.baz.foo>;

function func() {
  let bar = {};
  <bar></bar>;
}
