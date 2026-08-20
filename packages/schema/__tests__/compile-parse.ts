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
    e: t.tuple([t.bigint, t.boolean, t.null], t.literal("abc"), true),
    f: t.record(t.number, t.string),
    g: t.func(t.tuple([t.null, t.undefined, t.string]), t.boolean),
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
  const opts = {
    abortEarly: false,
  };

  //@ts-ignore
  globalThis.SchemaOpCtx = SchemaOpCtx;

  expect(parse(value, opts)).toMatchSnapshot();
});
