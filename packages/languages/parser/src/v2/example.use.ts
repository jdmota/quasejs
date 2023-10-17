import { parse } from "./example.gen";

console.log(
  parse(
    {
      externalCall(arg0, arg1: any) {
        console.log("external arg", arg0, arg1, arg1.text.loc);
      },
    },
    "AACSTRING"
  )
);
