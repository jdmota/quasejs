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
  e: t.tuple(
    [
      t.bigint,
      t.boolean,
      t.null,
      {
        type: t.literal("abc"),
        rest: true,
      },
    ],
    true
  ),
  f: t.record(t.number, t.string),
  g: t.func([t.null, t.undefined, t.string], t.boolean),
});

const compiledParse = compileParse(obj);

writeFileSync(
  "packages/schema/__examples__/parse.js",
  "//@ts-check\n" +
    compiledParse.contents +
    `\nexport default ${compiledParse.entryFunc};\n`
);

const compiledTs = compileTs(obj);

writeFileSync(
  "packages/schema/__examples__/parse.d.ts",
  compiledTs.contents + `\nexport default ${compiledTs.entryType};\n`
);

// yarn n packages/schema/__examples__/index.ts
