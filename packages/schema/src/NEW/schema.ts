import { type Opaque } from "../../../util/miscellaneous";
import { type FormElementOrPage } from "./forms/forms";
import { SchemaOpCtx, type SchemaOpCtxOpts } from "./util/context";
import { ValidationResult } from "./util/result";

export type RefinerOpts = Partial<{
  readonly message: string;
  readonly path: readonly string[];
}>;

const INPUT = Symbol();
const OUTPUT = Symbol();

export type SchemaInput<D extends SchemaType<any, any>> = D[typeof INPUT];

export type SchemaOutput<D extends SchemaType<any, any>> = D[typeof OUTPUT];

export type SchemaDecorators = {
  readonly description: string | null;
  readonly form: FormElementOrPage<string, string> | null;
};

export abstract class SchemaType<In, Out> {
  readonly [INPUT]!: In;
  readonly [OUTPUT]!: Out;

  abstract getInputType(): SchemaType<any, any>;

  abstract getDecorators(): SchemaDecorators;

  parse(value: unknown, opts: SchemaOpCtxOpts = {}): ValidationResult<Out> {
    const ctx = SchemaOpCtx.new(opts);
    return this.par(value, ctx);
  }

  abstract par(value: unknown, ctx: SchemaOpCtx): ValidationResult<Out>;

  decorators(opts: Partial<SchemaDecorators>) {
    return new SchemaDecorated(this, opts);
  }

  opaque<B extends PropertyKey>(brand: B) {
    return new SchemaTypeOpaque(this, brand);
  }

  refine(
    fn: (value: Out, ctx: SchemaOpCtx) => boolean,
    opts?: RefinerOpts
  ): SchemaType<In, Out>;
  refine<Refined extends Out>(
    fn: (value: Out, ctx: SchemaOpCtx) => value is Refined,
    opts?: RefinerOpts
  ): SchemaType<In, Refined>;
  refine<Refined extends Out>(
    fn: (value: Out, ctx: SchemaOpCtx) => value is Refined,
    opts: RefinerOpts = {}
  ): SchemaType<In, Refined> {
    return new SchemaTypeRefineSimple(this, fn, opts);
  }

  refineMore(fn: (value: Out, ctx: SchemaOpCtx) => void): SchemaType<In, Out> {
    return new SchemaTypeRefineMore(this, fn);
  }

  merge(dest: Out, value: Out): Out {
    throw new Error("");
  }

  default(
    defaultValue: Exclude<Out, undefined>
  ): SchemaDefault<"undefined", In, Out>;
  default<const D extends DefaultMode>(
    defaultValue: D extends "nullish"
      ? Exclude<Out, undefined | null>
      : Exclude<Out, undefined>,
    mode: D
  ): SchemaDefault<D, In, Out>;
  default(defaultValue: any, mode: DefaultMode = "undefined") {
    return new SchemaDefault(this, defaultValue, mode);
  }

  transform<Out2>(
    fn: (
      value: Out,
      ctx: SchemaOpCtx,
      never: typeof SCHEMA_NEVER
    ) => Out2 | typeof SCHEMA_NEVER
  ): SchemaType<In, Out2> {
    return new SchemaTransform(this, fn);
  }

  pipe<Out2>(out: SchemaType<unknown, Out2>): SchemaType<In, Out2> {
    return new SchemaPipe(this, out);
  }
}

const DEFAULT_REFINE_ERROR = "Refinement validation error";

export class SchemaTypeRefineSimple<
  const In,
  const Out,
  const Refined extends Out,
> extends SchemaType<In, Refined> {
  constructor(
    private readonly parent: SchemaType<In, Out>,
    private readonly fn: (value: Out, ctx: SchemaOpCtx) => value is Refined,
    private readonly opts: RefinerOpts = {}
  ) {
    super();
  }

  override getInputType() {
    const parentRootType = this.parent.getInputType();
    return this.parent === parentRootType ? this : parentRootType;
  }

  override getDecorators() {
    return this.parent.getDecorators();
  }

  override par(value: unknown, ctx: SchemaOpCtx) {
    const r = this.parent.par(value, ctx);
    if (r.ok) {
      if (!this.fn(r.value, ctx)) {
        if (this.opts.path) for (const p of this.opts.path) ctx.push(p);
        ctx.addError(this.opts.message ?? DEFAULT_REFINE_ERROR);
        if (this.opts.path) for (const p of this.opts.path) ctx.pop();
        return ctx.returnErrors();
      }
      return ctx.result(r.value);
    }
    return r;
  }
}

export class SchemaTypeRefineMore<const In, const Out> extends SchemaType<
  In,
  Out
> {
  constructor(
    private readonly parent: SchemaType<In, Out>,
    private readonly fn: (value: Out, ctx: SchemaOpCtx) => void
  ) {
    super();
  }

  override getInputType() {
    const parentRootType = this.parent.getInputType();
    return this.parent === parentRootType ? this : parentRootType;
  }

  override getDecorators() {
    return this.parent.getDecorators();
  }

  override par(value: unknown, ctx: SchemaOpCtx) {
    const r = this.parent.par(value, ctx);
    if (r.ok) {
      this.fn(r.value, ctx);
      return ctx.result(r.value);
    }
    return r;
  }
}

export class SchemaTypeOpaque<
  const In,
  const Out,
  const B extends PropertyKey,
> extends SchemaType<In, Opaque<Out, B>> {
  constructor(
    public readonly inner: SchemaType<In, Out>,
    public readonly brand: B
  ) {
    super();
  }

  override getInputType(): SchemaType<any, any> {
    const parentRootType = this.inner.getInputType();
    return this.inner === parentRootType ? this : parentRootType;
  }

  override getDecorators() {
    return this.inner.getDecorators();
  }

  override par(
    value: unknown,
    ctx: SchemaOpCtx
  ): ValidationResult<Opaque<Out, B>> {
    return this.inner.par(value, ctx) as any;
  }
}

export class SchemaDecorated<const In, const Out> extends SchemaType<In, Out> {
  constructor(
    public readonly inner: SchemaType<In, Out>,
    public readonly decorations: Partial<SchemaDecorators>
  ) {
    super();
  }

  override getInputType(): SchemaType<any, any> {
    const parentRootType = this.inner.getInputType();
    return this.inner === parentRootType ? this : parentRootType;
  }

  override getDecorators() {
    return {
      ...this.inner.getDecorators(),
      ...this.decorations,
    };
  }

  override par(value: unknown, ctx: SchemaOpCtx): ValidationResult<Out> {
    return this.inner.par(value, ctx);
  }
}

export type DefaultMode = "undefined" | "nullish";

export class SchemaDefault<
  const D extends DefaultMode,
  const In,
  const Out,
> extends SchemaType<
  In,
  D extends "nullish" ? Exclude<Out, undefined | null> : Exclude<Out, undefined>
> {
  constructor(
    private readonly parent: SchemaType<
      In,
      D extends "nullish" ? Out | undefined | null : Out | undefined
    >,
    private readonly defaultValue: D extends "nullish"
      ? Exclude<Out, undefined | null>
      : Exclude<Out, undefined>,
    private readonly mode: D
  ) {
    super();
  }

  override getInputType() {
    return this.parent.getInputType();
  }

  override getDecorators() {
    return this.parent.getDecorators();
  }

  override par(
    value: unknown,
    ctx: SchemaOpCtx
  ): ValidationResult<
    D extends "nullish"
      ? Exclude<Out, undefined | null>
      : Exclude<Out, undefined>
  > {
    const r = this.parent.par(value, ctx);
    if (r.ok) {
      if (this.mode === "undefined") {
        if (r.value === undefined) return ctx.result(this.defaultValue);
      } else {
        if (r.value == null) return ctx.result(this.defaultValue);
      }
      return ctx.result(r.value as any);
    }
    return r;
  }
}

export const SCHEMA_NEVER = Symbol("never");

export class SchemaTransform<In, Out, Out2> extends SchemaType<In, Out2> {
  constructor(
    private readonly parent: SchemaType<In, Out>,
    private readonly fn: (
      value: Out,
      ctx: SchemaOpCtx,
      never: typeof SCHEMA_NEVER
    ) => Out2 | typeof SCHEMA_NEVER
  ) {
    super();
  }

  override getInputType() {
    return this.parent.getInputType();
  }

  override getDecorators() {
    return this.parent.getDecorators();
  }

  override par(value: unknown, ctx: SchemaOpCtx) {
    const r = this.parent.par(value, ctx);
    if (r.ok) {
      const transformed = this.fn(r.value, ctx, SCHEMA_NEVER);
      if (transformed === SCHEMA_NEVER) {
        return ctx.defaultError("Transformation error");
      }
      return ctx.result(transformed);
    }
    return r;
  }
}

export class SchemaPipe<In, Out> extends SchemaType<In, Out> {
  constructor(
    private readonly inSchema: SchemaType<In, unknown>,
    private readonly outSchema: SchemaType<unknown, Out>
  ) {
    super();
  }

  override getInputType() {
    return this.inSchema.getInputType();
  }

  override getDecorators() {
    return this.inSchema.getDecorators();
  }

  override par(value: unknown, ctx: SchemaOpCtx) {
    const r = this.inSchema.par(value, ctx);
    if (r.ok) {
      return this.outSchema.par(r.value, ctx);
    }
    return r;
  }
}
