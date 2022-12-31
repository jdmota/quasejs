import { Result, Option } from "./util/result";
import { SchemaOpCtx as Ctx } from "./util/context";

export type SchemaType<A, I, O, C> = {
  validate: (value: A, ctx: Ctx) => void;
  decodeJS: (value: I, ctx: Ctx) => Result<A>;
  encodeJS: (value: A, ctx: Ctx) => Result<O>;
  coerce: (value: C, ctx: Ctx) => Result<I>;
  form: (ctx: Ctx) => null;
  default: (ctx: Ctx) => Option<A>;
};

// Inspired in https://zod.dev/ and https://gcanti.github.io/io-ts/

export type GetSchemaTS<S> = S extends SchemaType<
  infer A,
  infer _,
  infer _,
  infer _
>
  ? A
  : never;

type SchemaTypeKeys = keyof SchemaType<unknown, unknown, unknown, unknown>;

export type PickSchemaType<
  Keys extends SchemaTypeKeys,
  A,
  I = unknown,
  O = unknown,
  C = unknown
> = Pick<SchemaType<A, I, O, C>, Keys>;

export function createSchemaType<
  Keys extends SchemaTypeKeys,
  A,
  I = unknown,
  O = unknown,
  C = unknown
>(schema: PickSchemaType<Keys, A, I, O, C>) {
  return schema;
}
