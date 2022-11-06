import { Result, Option } from "./util/result";
import { SchemaOpCtx as Ctx } from "./util/context";

export type SchemaType<A, C, O, I> = {
  validate: (value: A, ctx: Ctx) => void;
  decodeJS: (value: I, ctx: Ctx) => Result<A>;
  encodeJS: (value: A, ctx: Ctx) => Result<O>;
  coerce: (value: C, ctx: Ctx) => Result<A>;
  form: (ctx: Ctx) => null;
  default: (ctx: Ctx) => Option<A>;
};

export type GetSchemaTS<S> = S extends SchemaType<
  infer A,
  infer _,
  infer _,
  infer _
>
  ? A
  : never;

export type PartialSchemaType<A, C, O, I> = Partial<SchemaType<A, C, O, I>>;

export function createSchemaType<A, C, O, I>(
  schema: PartialSchemaType<A, C, O, I>
) {
  return schema;
}
