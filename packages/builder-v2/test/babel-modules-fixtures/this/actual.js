import "foo";
import "foo-bar";
import "./directory/foo-bar";
import foo from "foo2";
import * as foo2 from "foo3";
import { bar } from "foo4";
import { foo as bar2 } from "foo5";

let a = this;

if ( a ) {
  let b = this;
}

function c() {
  return this;
}

let d = () => {
  return this;
};

let e = () => this;
