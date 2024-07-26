import { type Opaque } from "../../../../util/miscellaneous";
import { SchemaOpCtx } from "../util/context";
import {
  then,
  type ValidationOK,
  type ValidationResult,
  type ValidationResultMaybeAsync,
} from "../util/result";
import type { JsType } from "./js-types";

export type RefinerOpts = Partial<{
  readonly message: string;
  readonly path: readonly string[];
}>;

export type SchemaStatic<S> = S extends SchemaType<infer T> ? T : never;

export abstract class SchemaType<T> {
  test(value: unknown): value is T {
    const result = this.validate(value, new SchemaOpCtx());
    if (result instanceof Promise) {
      throw new Error("test() should be sync");
    }
    return result.ok;
  }

  abstract validate(
    value: unknown,
    ctx?: SchemaOpCtx
  ): ValidationResultMaybeAsync<T>;

  refine(
    fn: (value: T) => boolean | Promise<boolean>,
    opts: RefinerOpts = {}
  ): SchemaType<T> {
    return new SchemaRefinementSimpleType(this, fn, opts);
  }

  refineMore(
    fn: (value: T, ctx: SchemaOpCtx) => void | Promise<void>
  ): SchemaType<T> {
    return new SchemaRefinementMoreType(this, fn);
  }

  opaque<B extends PropertyKey>(brand: B): SchemaType<Opaque<T, B>> {
    return new SchemaOpaqueType<T, B>(this, brand);
  }

  cast<C>(type: JsType<C>): SchemaType<C> {
    return new SchemaCastType<C, T>(this, type);
  }
}

export class SchemaRefinementSimpleType<T> extends SchemaType<T> {
  constructor(
    private readonly parent: SchemaType<T>,
    private readonly fn: (value: T) => boolean | Promise<boolean>,
    private readonly opts: RefinerOpts = {}
  ) {
    super();
  }

  override validate(
    value: unknown,
    ctx = new SchemaOpCtx()
  ): ValidationResultMaybeAsync<T> {
    return then(this.parent.validate(value, ctx), r => {
      if (r.ok) {
        return then(this.fn(r.value), bool => {
          if (!bool) {
            if (this.opts.path) for (const p of this.opts.path) ctx.push(p);
            ctx.addError(this.opts.message ?? "Validation error");
          }
          return ctx.result(r.value);
        });
      }
      return r;
    });
  }
}

export class SchemaRefinementMoreType<T> extends SchemaType<T> {
  constructor(
    private readonly parent: SchemaType<T>,
    private readonly fn: (value: T, ctx: SchemaOpCtx) => void | Promise<void>
  ) {
    super();
  }

  override validate(
    value: unknown,
    ctx = new SchemaOpCtx()
  ): ValidationResultMaybeAsync<T> {
    return then(this.parent.validate(value, ctx), r => {
      if (r.ok) {
        return then(this.fn(r.value, ctx), () => ctx.result(r.value));
      }
      return r;
    });
  }
}

export class SchemaOpaqueType<T, B extends PropertyKey> extends SchemaType<
  Opaque<T, B>
> {
  constructor(
    private readonly parent: SchemaType<T>,
    public readonly brand: B
  ) {
    super();
  }

  override validate(
    value: unknown,
    ctx = new SchemaOpCtx()
  ): ValidationResultMaybeAsync<Opaque<T, B>> {
    return then(this.parent.validate(value, ctx), r =>
      r.ok ? (r satisfies ValidationResult<T> as ValidationOK<Opaque<T, B>>) : r
    );
  }
}

export class SchemaCastType<T, I = T> extends SchemaType<T> {
  constructor(
    private readonly parent: SchemaType<I>,
    public readonly jsType: JsType<T>
  ) {
    super();
  }

  override validate(
    value: unknown,
    ctx = new SchemaOpCtx()
  ): ValidationResultMaybeAsync<T> {
    return this.parent.validate(
      value,
      ctx
    ) satisfies ValidationResultMaybeAsync<I> as ValidationResultMaybeAsync<T>;
  }
}
