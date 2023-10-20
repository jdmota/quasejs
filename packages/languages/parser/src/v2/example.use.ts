import { parse } from "./example.gen";

console.log(
  parse(
    {
      externalCall(arg0, arg1) {
        console.log("external arg", arg0, arg1, arg1.text);
      },
    },
    "AACSTRING"
  )
);
