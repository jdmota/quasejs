import { parse } from "./example.gen.mjs";

const ast = parse(
  {
    externalCall(arg0, arg1) {
      console.log("external arg", arg0, arg1, arg1.text);
      return true;
    },
  },
  "AACSTRING"
);

const d = ast.d;
const d0 = d[0];

console.log(ast);
