import { writeFileSync } from "fs";
import { builtin as t } from "../builtin-types";
import { compileParse } from "../compilers/compile-parse";
import "../compilers/impl/parse";
import { compileTs } from "../compilers/compile-ts";
import "../compilers/impl/ts-type";

const obj = t.object({
  a: t.null,
  b: t.number,
  c: t.array(t.string),
  d: t.object(
    {},
    {
      key: t.string,
      value: t.bigint,
    }
  ),
  e: t.tuple([t.bigint, t.boolean, t.null], t.literal("abc"), true),
  f: t.record(t.number, t.string),
  g: t.func(t.tuple([t.null, t.undefined, t.string]), t.boolean),
});

writeFileSync(
  "packages/schema/__examples__/parse.js",
  compileParse(obj).fileContents
);

writeFileSync(
  "packages/schema/__examples__/parse.d.ts",
  compileTs(obj).fileContents
);

// yarn n packages/schema/__examples__/index.ts
