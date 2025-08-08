import "foo";
import "foo-bar";
import "./directory/foo-bar";
import foo from "foo2";
import * as foo2 from "foo3";
import { bar } from "foo4";
import { foo as bar2 } from "foo5";

export {} from "foo6";

import {} from "foo7";
import {} from "foo7";

import {} from "foo8";
import { a } from "foo8";

function test() {}
export { test };
export var test2 = 5;

bar;
bar2;
foo;

a;
a;
