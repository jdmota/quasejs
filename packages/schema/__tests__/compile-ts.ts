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

it("compile ts alias", () => {
  const type = t
    .object({
      a: t.array(t.string),
    })
    .alias("alias_name");

  const compiled = compileTs(type);

  expect(compiled).toMatchSnapshot();
});

it("compile ts recursive", () => {
  const type = t.rec(that => {
    return t.array(that);
  });

  const compiled = compileTs(type);

  expect(compiled).toMatchSnapshot();
});
