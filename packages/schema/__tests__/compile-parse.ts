import { beforeAll, expect, it } from "@jest/globals";
import { builtin as t } from "../builtin-types";
import {
  compileParse,
  registerParseCompilers,
} from "../compilers/compile-parse";
import { SchemaOpCtx } from "../util/context";

beforeAll(async () => {
  await registerParseCompilers();
});

it("compile parse example", () => {
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

  expect(compiled).toMatchSnapshot();

  const parse = compiled.makeFunc();

  expect(
    parse(
      {
        a: undefined,
      },
      SchemaOpCtx.new()
    )
  ).toMatchSnapshot();
});
