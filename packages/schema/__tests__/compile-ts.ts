import { beforeAll, expect, it } from "@jest/globals";
import { builtin as t } from "../builtin-types";
import { compileTs, registerTsCompilers } from "../compilers/compile-ts";

beforeAll(async () => {
  await registerTsCompilers();
});

it("compile ts example", () => {
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

  const compiled = compileTs(obj);

  expect(compiled).toMatchSnapshot();
});
