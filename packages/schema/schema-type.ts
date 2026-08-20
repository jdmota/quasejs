import type { Opaque } from "../util/miscellaneous";
import type { Option } from "../util/monads";
import type { BuiltinSchemaType } from "./builtin-types";
import { SchemaOpCtx, type SchemaOpCtxOpts } from "./util/context";
import type { ValidationResult } from "./util/result";

const INPUT = Symbol();
const OUTPUT = Symbol();
const ERR = Symbol();

/* export const $output: unique symbol = Symbol("quasejs.schema.output");
export type $output = typeof $output;
export const $input: unique symbol = Symbol("quasejs.schema.input");
export type $input = typeof $input; */

export type SchemaInput<D extends SchemaType<any, any, any>> = D[typeof INPUT];

export type SchemaOutput<D extends SchemaType<any, any, any>> =
  D[typeof OUTPUT];

export type SchemaError<D extends SchemaType<any, any, any>> = D[typeof ERR];

export type AnySchema = SchemaType<any, any, any>;

export interface SchemaDecorator<
  Target extends AnySchema,
  Out extends AnySchema,
> {
  getName(): string;
  build(target: Target): Out;
}

// TODO handle error types
export abstract class SchemaType<In, Out, Err> {
  readonly [INPUT]!: In;
  readonly [OUTPUT]!: Out;
  readonly [ERR]!: Err;

  constructor(readonly metadata?: unknown) {}

  abstract getName(): string;
  abstract getBuiltin(): BuiltinSchemaType<any, any, any>;

  alias(name: string) {
    return new SchemaAlias(this, name);
  }

  decorate<T extends AnySchema>(decorator: SchemaDecorator<this, T>) {
    return decorator.build(this);
  }

  abstract par(value: unknown, ctx: SchemaOpCtx): Option<Out>;

  parse(value: unknown, opts?: SchemaOpCtxOpts): ValidationResult<Out, Err> {
    const ctx = SchemaOpCtx.new(opts);
    const opt = this.par(value, ctx);
    return ctx.validationResult(opt);
  }

  opaque<B extends string>(brand: B) {
    return new SchemaTypeOpaque(this, brand);
  }

  check(
    fn: (value: Out) => boolean,
    message = "Check error"
  ): SchemaType<In, Out, Err> {
    return new SchemaTypeCheck(this, (value, ctx) => {
      const check = fn(value);
      if (!check) {
        ctx.addError("check", message);
      }
    });
  }

  checkMore(
    fn: (value: Out, ctx: SchemaOpCtx) => void
  ): SchemaType<In, Out, Err> {
    return new SchemaTypeCheck(this, fn);
  }

  merge(dest: Out, value: Out): Out {
    throw new Error("");
  }

  default(defaultValue: Out, mode: DefaultMode = "undefined") {
    return new SchemaDefault(this, defaultValue, mode);
  }

  transform<Out2>(
    fn: (value: Out, ctx: SchemaOpCtx) => Out2
  ): SchemaType<In, Out2, Err> {
    return new SchemaTransform(this, fn);
  }

  pipe<Out2, Err>(
    out: SchemaType<unknown, Out2, Err>
  ): SchemaType<In, Out2, Err> {
    return new SchemaPipe(this, out);
  }
}

export class SchemaAlias<In, Out, Err> extends SchemaType<In, Out, Err> {
  static build<In, Out, Err>(target: SchemaType<In, Out, Err>, name: string) {
    return new SchemaAlias(target, name);
  }

  readonly _tag = "SchemaAlias";

  constructor(
    readonly target: SchemaType<In, Out, Err>,
    readonly name: string
  ) {
    super();
  }

  override getName() {
    return this.name;
  }

  override getBuiltin() {
    return this.target.getBuiltin();
  }

  override par(value: unknown, ctx: SchemaOpCtx): Option<Out> {
    return this.target.par(value, ctx);
  }
}

export class SchemaTypeCheck<const In, const Out, const Err> extends SchemaType<
  In,
  Out,
  Err
> {
  constructor(
    private readonly parent: SchemaType<In, Out, Err>,
    private readonly fn: (value: Out, ctx: SchemaOpCtx) => void
  ) {
    super();
  }

  override getName() {
    return this.parent.getName();
  }

  override getBuiltin() {
    return this.parent.getBuiltin();
  }

  /* override getInputType() {
    const parentRootType = this.parent.getInputType();
    return this.parent === parentRootType ? this : parentRootType;
  } */

  override par(value: unknown, ctx: SchemaOpCtx) {
    const r = this.parent.par(value, ctx);
    if (r.some) {
      this.fn(r.value, ctx);
      return ctx.result(r.value);
    }
    return r;
  }
}

export class SchemaTypeOpaque<
  const In,
  const Out,
  const B extends string,
  const Err,
> extends SchemaType<In, Opaque<Out, B>, Err> {
  constructor(
    public readonly inner: SchemaType<In, Out, Err>,
    public readonly brand: B
  ) {
    super();
  }

  override getName() {
    return this.brand;
  }

  override getBuiltin() {
    return this.inner.getBuiltin();
  }

  /* override getInputType(): AnySchema {
    const parentRootType = this.inner.getInputType();
    return this.inner === parentRootType ? this : parentRootType;
  } */

  override par(value: unknown, ctx: SchemaOpCtx): Option<Opaque<Out, B>> {
    return this.inner.par(value, ctx) as any;
  }
}

export type DefaultMode = "undefined" | "nullish";

export class SchemaDefault<const In, const Out, const Err> extends SchemaType<
  In,
  Out,
  Err
> {
  constructor(
    private readonly parent: SchemaType<In, Out, Err>,
    private readonly defaultValue: Out,
    private readonly mode: DefaultMode
  ) {
    super();
  }

  override getName() {
    return this.parent.getName();
  }

  override getBuiltin() {
    return this.parent.getBuiltin();
  }

  /* override getInputType() {
    return this.parent.getInputType();
  } */

  override par(value: unknown, ctx: SchemaOpCtx): Option<Out> {
    if (this.mode === "undefined") {
      if (value === undefined) return ctx.result(this.defaultValue);
    } else {
      if (value == null) return ctx.result(this.defaultValue);
    }
    return this.parent.par(value, ctx);
  }
}

export class SchemaTransform<In, Out, Out2, Err> extends SchemaType<
  In,
  Out2,
  Err
> {
  constructor(
    private readonly parent: SchemaType<In, Out, Err>,
    private readonly fn: (value: Out, ctx: SchemaOpCtx) => Out2
  ) {
    super();
  }

  override getName() {
    return this.parent.getName();
  }

  override getBuiltin() {
    return this.parent.getBuiltin();
  }

  /* override getInputType() {
    return this.parent.getInputType();
  } */

  override par(value: unknown, ctx: SchemaOpCtx) {
    const r = this.parent.par(value, ctx);
    if (r.some) {
      const transformed = this.fn(r.value, ctx);
      return ctx.result(transformed);
    }
    return ctx.none;
  }
}

export class SchemaPipe<In, Out, Err> extends SchemaType<In, Out, Err> {
  constructor(
    private readonly inSchema: SchemaType<In, unknown, unknown>,
    private readonly outSchema: SchemaType<unknown, Out, Err>
  ) {
    super();
  }

  override getName() {
    return this.outSchema.getName();
  }

  override getBuiltin() {
    return this.inSchema.getBuiltin();
  }

  override par(value: unknown, ctx: SchemaOpCtx) {
    const r = this.inSchema.par(value, ctx);
    if (r.some) {
      return this.outSchema.par(r.value, ctx);
    }
    return r;
  }
}
