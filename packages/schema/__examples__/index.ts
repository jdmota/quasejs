import { writeFileSync } from "fs";
import { builtin as t } from "../builtin-types";
import { compileParse } from "../compilers/compile-parse";

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
});

const compiled = compileParse(obj);

writeFileSync(
  "packages/schema/__examples__/parse.js",
  "//@ts-check\n" +
    compiled.contents +
    `\nexport default ${compiled.entryFunc};\n`
);

// yarn n packages/schema/__examples__/index.ts
