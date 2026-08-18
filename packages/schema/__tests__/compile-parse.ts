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

  const compiled = compileParse(obj);

  expect(compiled).toMatchSnapshot();

  const parse = compiled.makeFunc();
  const value = {
    a: undefined,
    b: "",
    c: {},
    d: [],
  };
  const ctx = SchemaOpCtx.new({
    abortEarly: false,
  });

  expect(parse(value, ctx)).toMatchSnapshot();
  expect(ctx.validationResult(value)).toMatchSnapshot();
});
