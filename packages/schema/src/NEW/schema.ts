import { then, ValidationResult } from "./util/result";
import { SchemaOpCtx as Ctx } from "./util/context";
import { CompilableOrNotFun, getFunc } from "./compilable-fun";

// Inspired in https://zod.dev/ and https://gcanti.github.io/io-ts/

export type GetSchemaInput<S> =
  S extends SchemaType<infer I, infer _> ? I : never;

export type GetSchemaOutput<S> =
  S extends SchemaType<infer _, infer O> ? O : never;

export type SchemaType<I, O> = SchemaTypeSync<I, O> | SchemaTypeAsync<I, O>;

export type SchemaTypeSync<I, O> = ISchemaType<I, O, SchemaSyncKind.sync>;

export type SchemaTypeAsync<I, O> = ISchemaType<I, O, SchemaSyncKind.async>;

export enum SchemaSyncKind {
  sync = 0,
  async = 1,
}

export function createSchemaType<I, O>(
  fn: PipeFn<I, O, SchemaSyncKind.sync>
): SchemaTypeSync<I, O>;

export function createSchemaType<I, O>(
  fn: PipeFn<I, O, SchemaSyncKind.async>
): SchemaTypeAsync<I, O>;

export function createSchemaType<I, O, A extends SchemaSyncKind>(
  fn: PipeFn<I, O, A>
): any {
  return new SchemaTypeImpl(fn);
}

interface ISchemaType<I, O, A extends SchemaSyncKind> {
  parse(value: I, ctx?: Ctx): FuncResult<ValidationResult<O>, A>;

  use<I2, O2>(
    fn: (
      value: I2,
      ctx: Ctx,
      prev: (value: I, ctx: Ctx) => FuncResult<ValidationResult<O>, A>
    ) => FuncResult<ValidationResult<O2>, A>
  ): ISchemaType<I2, O2, A>;

  use<I2, O2>(
    fn: (
      value: I2,
      ctx: Ctx,
      prev: (value: I, ctx: Ctx) => FuncResult<ValidationResult<O>, A>
    ) => Promise<ValidationResult<O2>>
  ): ISchemaType<I2, O2, SchemaSyncKind.async>;

  pipe<T>(
    fn: (value: O, ctx: Ctx) => ValidationResult<T>
  ): ISchemaType<I, T, A>;

  pipe<T>(
    fn: (value: O, ctx: Ctx) => Promise<ValidationResult<T>>
  ): ISchemaType<I, T, SchemaSyncKind.async>;

  transform<T>(fn: (value: O) => T): ISchemaType<I, T, A>;

  transform<T>(
    fn: (value: O) => Promise<T>
  ): ISchemaType<I, T, SchemaSyncKind.async>;

  refine(fn: (value: O) => boolean, opts?: RefinerOpts): ISchemaType<I, O, A>;

  refine(
    fn: (value: O) => Promise<boolean>,
    opts?: RefinerOpts
  ): ISchemaType<I, O, SchemaSyncKind.async>;

  refineMore(fn: (value: O, ctx: Ctx) => void): ISchemaType<I, O, A>;

  refineMore(
    fn: (value: O, ctx: Ctx) => Promise<void>
  ): ISchemaType<I, O, SchemaSyncKind.async>;
}

class SchemaTypeImpl<I, O, A extends SchemaSyncKind>
  implements ISchemaType<I, O, A>
{
  constructor(protected readonly fn: PipeFn<I, O, A>) {}

  parse(value: I, ctx: Ctx = new Ctx()): FuncResult<ValidationResult<O>, A> {
    return getFunc(this.fn)(value, ctx);
  }

  use(fn: any): any {
    return new SchemaTypeImpl((value, ctx) => fn(value, ctx, this.fn));
  }

  pipe<T>(
    fn: (
      value: O,
      ctx: Ctx
    ) => ValidationResult<T> | Promise<ValidationResult<T>>
  ): any {
    return new SchemaTypeImpl<I, T, any>((value, ctx) =>
      then(getFunc(this.fn)(value, ctx), r => (r.ok ? fn(r.value, ctx) : r))
    );
  }

  transform<T>(fn: (value: O) => T | Promise<T>) {
    return this.pipe((value, ctx) => then(fn(value), v => ctx.result(v)));
  }

  refine(fn: (value: O) => boolean | Promise<boolean>, opts: RefinerOpts = {}) {
    return this.pipe((value, ctx) =>
      then(fn(value), bool => {
        if (!bool) {
          if (opts.path) for (const p of opts.path) ctx.push(p);
          ctx.addError(opts.message ?? "Validation error");
        }
        return ctx.result(value);
      })
    );
  }

  refineMore(fn: (value: O, ctx: Ctx) => void | Promise<void>) {
    return this.pipe((value, ctx) =>
      then(fn(value, ctx), () => ctx.result(value))
    );
  }
}

type FuncResult<T, A extends SchemaSyncKind> = A extends SchemaSyncKind.sync
  ? T
  : Promise<T>;

type PipeFn<I, O, A extends SchemaSyncKind> = CompilableOrNotFun<
  [value: I, ctx: Ctx],
  FuncResult<ValidationResult<O>, A>
>;

export type RefinerOpts = Partial<{
  readonly message: string;
  readonly path: readonly string[];
}>;

export abstract class MutableSchemaImpl<I, O> {
  abstract parse(value: I, ctx?: Ctx): ValidationResultMaybeAsync<O>;

  abstract use<I2, O2>(
    fn: (
      value: I2,
      ctx: Ctx,
      prev: (value: I, ctx: Ctx) => ValidationResultMaybeAsync<O>
    ) => ValidationResultMaybeAsync<O2>
  ): MutableSchemaImpl<I2, O2>;

  abstract pipe<T>(
    fn: (value: O, ctx: Ctx) => ValidationResultMaybeAsync<T>
  ): MutableSchemaImpl<I, T>;

  abstract transform<T>(fn: (value: O) => T): MutableSchemaImpl<I, T>;

  abstract refine(
    fn: (value: O) => boolean,
    opts?: RefinerOpts
  ): MutableSchemaImpl<I, O>;

  abstract refineMore(
    fn: (value: O, ctx: Ctx) => void
  ): MutableSchemaImpl<I, O>;
}
