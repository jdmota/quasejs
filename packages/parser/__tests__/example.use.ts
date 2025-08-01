import { parse } from "./example.gen.mjs";

const asts = parse(
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

console.log(asts);

// yarn n packages/parser/__tests__/example.use.ts
