import { inspect } from "util";
import { parse } from "./example.gen.mjs";

const result = parse(
  {
    externalCall(arg0, arg1) {
      console.log("external arg", arg0, arg1, arg1.text);
      return true;
    },
  },
  "AACSTRING",
  "$arg"
);

//const d = ast.d;
//const d0 = d[0];

console.log(inspect(result, { depth: 6, colors: true }));

// yarn n packages/parser/__examples__/example.use.ts
