import { Opaque } from "../../../../util/miscellaneous";
import { SchemaOpCtx as Ctx } from "../util/context";
import { formatKey } from "../util/format";
import { ValidationResult } from "../util/result";

const INTERNAL = Symbol();

// TODO should clone object? what if the same object appears in different places with different types that clone in different ways?

export abstract class JsType<T> {
  readonly [INTERNAL]!: T;

  constructor(public readonly type: string) {}

  validate(value: unknown, ctx: Ctx = new Ctx()): ValidationResult<T> {
    if (ctx.pushValue(value, this)) {
      this.validate(value, ctx);
      ctx.popValue(value);
    }
    return ctx.result(value as any);
  }

  protected abstract val(value: unknown, ctx: Ctx): ValidationResult<T>;
}

export type JsTypeStatic<D extends JsType<any>> = D[typeof INTERNAL];

type MaybeReadonly<T, R extends boolean> = R extends false ? T : Readonly<T>;

export class JsTypeLiteral<
  T extends number | bigint | string | boolean | symbol,
> extends JsType<T> {
  constructor(public readonly value: T) {
    super("literal");
  }

  protected val(
    value: unknown,
    ctx: Ctx
  ): ValidationResult<JsTypeStatic<this>> {
    if (value === this.value) {
      return ctx.result(this.value);
    }
    return ctx.error("Invalid literal");
  }
}

const ss = Symbol();
const ll = new JsTypeLiteral(ss);
type LL = JsTypeStatic<typeof ll>;

export class JsTypeAny extends JsType<any> {
  constructor() {
    super("any");
  }

  protected val(
    value: unknown,
    ctx: Ctx
  ): ValidationResult<JsTypeStatic<this>> {
    return ctx.result(value);
  }
}

export class JsTypeUnknown extends JsType<unknown> {
  constructor() {
    super("unknown");
  }

  protected val(
    value: unknown,
    ctx: Ctx
  ): ValidationResult<JsTypeStatic<this>> {
    return ctx.result(value);
  }
}

const u = new JsTypeUnknown();
type U = JsTypeStatic<typeof u>;

export class JsTypeNever extends JsType<never> {
  constructor() {
    super("never");
  }

  protected val(
    value: unknown,
    ctx: Ctx
  ): ValidationResult<JsTypeStatic<this>> {
    return ctx.error("Never");
  }
}

export class JsTypeUndefined extends JsType<undefined> {
  constructor() {
    super("undefined");
  }

  protected val(
    value: unknown,
    ctx: Ctx
  ): ValidationResult<JsTypeStatic<this>> {
    if (value === undefined) {
      return ctx.result(value);
    }
    return ctx.error("Value is not undefined");
  }
}

export class JsTypeNull extends JsType<null> {
  constructor() {
    super("null");
  }

  protected val(
    value: unknown,
    ctx: Ctx
  ): ValidationResult<JsTypeStatic<this>> {
    if (value === null) {
      return ctx.result(value);
    }
    return ctx.error("Value is not null");
  }
}

export class JsTypeString extends JsType<string> {
  constructor() {
    super("string");
  }

  protected val(
    value: unknown,
    ctx: Ctx
  ): ValidationResult<JsTypeStatic<this>> {
    if (typeof value === "string") {
      return ctx.result(value);
    }
    return ctx.error("Value is not a string");
  }
}

export class JsTypeNumber extends JsType<number> {
  constructor() {
    super("number");
  }

  protected val(
    value: unknown,
    ctx: Ctx
  ): ValidationResult<JsTypeStatic<this>> {
    if (typeof value === "number") {
      return ctx.result(value);
    }
    return ctx.error("Value is not a number");
  }
}

export class JsTypeBigint extends JsType<bigint> {
  constructor() {
    super("bigint");
  }

  protected val(
    value: unknown,
    ctx: Ctx
  ): ValidationResult<JsTypeStatic<this>> {
    if (typeof value === "bigint") {
      return ctx.result(value);
    }
    return ctx.error("Value is not a bigint");
  }
}

export class JsTypeBoolean extends JsType<boolean> {
  constructor() {
    super("boolean");
  }

  protected val(
    value: unknown,
    ctx: Ctx
  ): ValidationResult<JsTypeStatic<this>> {
    if (typeof value === "boolean") {
      return ctx.result(value);
    }
    return ctx.error("Value is not a boolean");
  }
}

export class JsTypeSymbol extends JsType<symbol> {
  constructor() {
    super("symbol");
  }

  protected val(
    value: unknown,
    ctx: Ctx
  ): ValidationResult<JsTypeStatic<this>> {
    if (typeof value === "symbol") {
      return ctx.result(value);
    }
    return ctx.error("Value is not a symbol");
  }
}

export class JsTypeArray<
  T extends JsType<any>,
  R extends boolean,
> extends JsType<MaybeReadonly<JsTypeStatic<T>[], R>> {
  constructor(
    public readonly element: T,
    public readonly readonly: R
  ) {
    super("array");
  }

  protected val(
    value: unknown,
    ctx: Ctx
  ): ValidationResult<JsTypeStatic<this>> {
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        ctx.push(i);
        this.element.validate(value[i], ctx);
        ctx.pop();
        if (ctx.shouldAbort()) break;
      }
      return ctx.result(value);
    }
    return ctx.error("Value is not an array");
  }
}

const aa = new JsTypeArray(new JsTypeBigint(), true);
type AA = JsTypeStatic<typeof aa>;

export class JsTypeTuple<
  const T extends readonly JsType<any>[],
  const Rest extends JsType<any> | null,
  const R extends boolean,
> extends JsType<
  MaybeReadonly<
    Rest extends JsType<any>
      ? [...{ [K in keyof T]: JsTypeStatic<T[K]> }, ...JsTypeStatic<Rest>[]]
      : { [K in keyof T]: JsTypeStatic<T[K]> },
    R
  >
> {
  constructor(
    public readonly elements: T,
    public readonly rest: Rest,
    public readonly readonly: R
  ) {
    super("tuple");
  }

  protected val(
    value: unknown,
    ctx: Ctx
  ): ValidationResult<JsTypeStatic<this>> {
    if (
      Array.isArray(value) &&
      (this.rest == null
        ? this.elements.length === value.length
        : this.elements.length <= value.length)
    ) {
      for (let i = 0; i < this.elements.length; i++) {
        ctx.push(i);
        this.elements[i].validate(value[i], ctx);
        ctx.pop();
        if (ctx.shouldAbort()) return ctx.returnErrors();
      }
      for (let i = this.elements.length; i < value.length; i++) {
        ctx.push(i);
        this.rest!.validate(value[i], ctx);
        ctx.pop();
        if (ctx.shouldAbort()) return ctx.returnErrors();
      }
      return ctx.result(value as any);
    }
    return ctx.error("Value is not a tuple of size " + this.elements.length);
  }
}

const str = new JsTypeString();
type Str = JsTypeStatic<typeof str>;

const tt = new JsTypeTuple([new JsTypeNull()], new JsTypeBigint(), true);
type TT = JsTypeStatic<typeof tt>;

type ObjStructure = {
  readonly [key: string]: Readonly<{
    readonly: boolean;
    partial: boolean;
    type: JsType<unknown>;
  }>;
};

type ExtractReadonlyPartial<S extends ObjStructure> = {
  [K in keyof S]: S[K]["readonly"] extends false
    ? never
    : S[K]["partial"] extends false
      ? never
      : K;
}[keyof S];

type ExtractReadonly<S extends ObjStructure> = {
  [K in keyof S]: S[K]["readonly"] extends false
    ? never
    : S[K]["partial"] extends false
      ? K
      : never;
}[keyof S];

type ExtractPartial<S extends ObjStructure> = {
  [K in keyof S]: S[K]["readonly"] extends false
    ? S[K]["partial"] extends false
      ? never
      : K
    : never;
}[keyof S];

type ExtractNotReadPartial<S extends ObjStructure> = {
  [K in keyof S]: S[K]["readonly"] extends false
    ? S[K]["partial"] extends false
      ? K
      : never
    : never;
}[keyof S];

type ExtractTsTypeFromObj<S extends ObjStructure> = {
  readonly [K in ExtractReadonlyPartial<S>]?: JsTypeStatic<S[K]["type"]>;
} & {
  readonly [K in ExtractReadonly<S>]: JsTypeStatic<S[K]["type"]>;
} & {
  [K in ExtractPartial<S>]?: JsTypeStatic<S[K]["type"]>;
} & {
  [K in ExtractNotReadPartial<S>]: JsTypeStatic<S[K]["type"]>;
};

type A = ExtractTsTypeFromObj<{
  a: { readonly: false; partial: false; type: JsTypeNumber };
}>;

const hasOwn = Object.prototype.hasOwnProperty;
const hasProp = (o: any, k: string) => hasOwn.call(o, k);
const getProp = (o: any, k: string) => (hasProp(o, k) ? o[k] : undefined);

const PROTO_KEY = "__proto__";

export class JsTypeObject<
  const S extends ObjStructure,
  const E extends boolean,
> extends JsType<
  E extends false
    ? ExtractTsTypeFromObj<S> & { [key: PropertyKey]: unknown }
    : ExtractTsTypeFromObj<S>
> {
  private readonly entries: [
    string,
    Readonly<{
      readonly: boolean;
      partial: boolean;
      type: JsType<unknown>;
    }>,
  ][];

  constructor(
    public readonly structure: S,
    public readonly exact: E
  ) {
    super("object");
    this.entries = Object.entries(structure);
    if (hasProp(structure, PROTO_KEY)) {
      throw new Error("Object type includes __proto__ key");
    }
  }

  protected val(
    object: unknown,
    ctx: Ctx
  ): ValidationResult<JsTypeStatic<this>> {
    if (typeof object === "object" && object != null) {
      // const newEntries = [];
      const extraneousKeys = new Set(Object.keys(object));
      if (extraneousKeys.has(PROTO_KEY)) {
        ctx.addError("Object has own property __proto__");
        if (ctx.shouldAbort()) return ctx.returnErrors();
      }
      for (const [key, { partial, type }] of this.entries) {
        ctx.push(key);
        const value = getProp(object, key);
        if (!partial || value !== undefined) {
          const decoded = type.validate(value, ctx);
          if (decoded.ok) {
            // newEntries.push([key, decoded.value] as const);
          }
        }
        ctx.pop();
        if (ctx.shouldAbort()) return ctx.returnErrors();
        extraneousKeys.delete(key);
      }
      if (this.exact && extraneousKeys.size > 0) {
        return ctx.error(
          `Extraneous properties: ${Array.from(extraneousKeys)
            .map(k => formatKey(k))
            .join(", ")}`
        );
      }
      return ctx.result(object as any); // Object.fromEntries(newEntries)
    }
    return ctx.error("Value is not an object");
  }
}

const A = new JsTypeObject(
  {
    a: { readonly: false, partial: false, type: new JsTypeNumber() },
  },
  false
);

type A2 = JsTypeStatic<typeof A>;

const obj: A2 = { a: 10, b: true };

export class JsTypeRecord<K extends PropertyKey, V> extends JsType<
  Record<K, V>
> {
  constructor(
    public readonly key: JsType<K>,
    public readonly value: JsType<V>
  ) {
    super("record");
  }

  protected val(
    object: unknown,
    ctx: Ctx
  ): ValidationResult<JsTypeStatic<this>> {
    if (typeof object === "object" && object != null) {
      if (hasProp(object, PROTO_KEY)) {
        ctx.addError("Object has own property __proto__");
        if (ctx.shouldAbort()) return ctx.returnErrors();
      }
      for (const [key, value] of Object.entries(object)) {
        ctx.push(key, true);
        this.key.validate(key, ctx);
        ctx.pop();
        if (ctx.shouldAbort()) return ctx.returnErrors();
        ctx.push(key, false);
        this.value.validate(value, ctx);
        ctx.pop();
        if (ctx.shouldAbort()) return ctx.returnErrors();
      }
      return ctx.result(object as any);
    }
    return ctx.error("Value is not an object");
  }
}

export class JsTypeUnion<const I extends readonly JsType<any>[]> extends JsType<
  {
    [K in keyof I]: JsTypeStatic<I[K]>;
  }[number]
> {
  constructor(public readonly items: I) {
    super("union");
  }

  protected val(
    value: unknown,
    ctx: Ctx
  ): ValidationResult<JsTypeStatic<this>> {
    for (const item of this.items) {
      const itemCtx = Ctx.new(ctx);
      item.validate(value, itemCtx);
      if (!itemCtx.hasErrors()) {
        return ctx.result(value as any);
      }
    }
    return ctx.error("Value does not belong to union");
  }
}

const uu = new JsTypeUnion([
  new JsTypeArray(new JsTypeString(), true),
  new JsTypeNull(),
]);
type UU = JsTypeStatic<typeof uu>;

export class JsTypeIntersection<
  L extends JsType<any>,
  R extends JsType<any>,
> extends JsType<JsTypeStatic<L> & JsTypeStatic<R>> {
  constructor(
    public readonly left: L,
    public readonly right: R
  ) {
    super("intersection");
  }

  protected val(
    value: unknown,
    ctx: Ctx
  ): ValidationResult<JsTypeStatic<this>> {
    this.left.validate(value, ctx);
    if (ctx.shouldAbort()) return ctx.returnErrors();
    this.right.validate(value, ctx);
    return ctx.result(value);
  }
}

const inter = new JsTypeIntersection(
  new JsTypeArray(new JsTypeString(), true),
  new JsTypeArray(new JsTypeString(), false)
);
type Inter = JsTypeStatic<typeof inter>;

export class JsTypeFunction<
  const Args extends JsTypeTuple<any, any, any>,
  const Ret extends JsType<any>,
> extends JsType<
  (...args: JsTypeStatic<Args>) => ValidationResult<JsTypeStatic<Ret>>
> {
  constructor(
    public readonly args: Args,
    public readonly ret: Ret
  ) {
    super("function");
  }

  protected val(
    value: unknown,
    ctx: Ctx
  ): ValidationResult<JsTypeStatic<this>> {
    if (typeof value === "function") {
      const newCtx = Ctx.new(ctx);
      return ctx.result(function (this: any, ...args: any[]) {
        this.args.validate(args, newCtx);
        if (newCtx.shouldAbort()) return newCtx.returnErrors();
        const result = Reflect.apply(value, this, args);
        this.ret.validate(result, newCtx);
        return newCtx.result(result);
      });
    }
    return ctx.error("Value is not a function");
  }
}

export class JsTypePromise<T> extends JsType<Promise<ValidationResult<T>>> {
  constructor(public readonly item: JsType<T>) {
    super("promise");
  }

  protected val(
    value: unknown,
    ctx: Ctx
  ): ValidationResult<JsTypeStatic<this>> {
    if (value instanceof Promise) {
      const newCtx = Ctx.new(ctx);
      return ctx.result(value.then(v => this.item.validate(v, newCtx)));
    }
    return ctx.error("Value is not a promise");
  }
}

const func = new JsTypeFunction(
  new JsTypeTuple(
    [new JsTypeArray(new JsTypeBigint(), true), new JsTypeString()],
    new JsTypeLiteral(10),
    true
  ),
  new JsTypePromise(new JsTypeBoolean())
);
type Func = JsTypeStatic<typeof func>;

type EnumLike = {
  readonly [k: string]: string | number;
};

export class JsTypeEnum<T extends EnumLike> extends JsType<T[keyof T]> {
  private values: readonly (string | number)[];

  constructor(public readonly enumeration: T) {
    super("enum");
    this.values = Object.values(enumeration);
  }

  protected val(value: unknown, ctx: Ctx): ValidationResult<T[keyof T]> {
    if (this.values.includes(value as any)) {
      return ctx.result(value as any);
    }
    return ctx.error("Value does not belong to enumeration");
  }
}

enum ENUM {
  a,
  b,
  c,
}
const EE = new JsTypeEnum(ENUM);
type ee = JsTypeStatic<typeof EE>;

export class JsTypeRecursive<T> extends JsType<T> {
  public readonly content: JsType<T>;

  constructor(fn: (that: JsTypeRecursive<T>) => JsType<T>) {
    super("recursive");
    this.content = fn(this);
  }

  protected val(
    value: unknown,
    ctx: Ctx
  ): ValidationResult<JsTypeStatic<this>> {
    return this.content.validate(value, ctx);
  }
}

export class JsTypeOpaque<T, B extends PropertyKey> extends JsType<
  Opaque<T, B>
> {
  constructor(
    public readonly inner: JsType<T>,
    public readonly brand: B
  ) {
    super("opaque");
  }

  protected val(
    value: unknown,
    ctx: Ctx
  ): ValidationResult<JsTypeStatic<this>> {
    return this.inner.validate(value, ctx) as any;
  }
}

type Class<T, Arguments extends unknown[] = any[]> = {
  prototype: Pick<T, keyof T>;
  new (...arguments_: Arguments): T;
};

export class JsTypeInstanceof<T> extends JsType<T> {
  constructor(public readonly clazz: Class<T>) {
    super("instanceof");
  }

  protected val(
    value: unknown,
    ctx: Ctx
  ): ValidationResult<JsTypeStatic<this>> {
    if (value instanceof this.clazz) {
      return ctx.result(value);
    }
    return ctx.error("Value is not an instanceof " + this.clazz.name);
  }
}

const ii = new JsTypeInstanceof(
  class A {
    a: number = 10;
  }
);
type II = JsTypeStatic<typeof ii>;

export const jsType = {
  any: new JsTypeAny(),
  unknown: new JsTypeUnknown(),
  never: new JsTypeNever(),
  undefined: new JsTypeUndefined(),
  null: new JsTypeNull(),
  string: new JsTypeString(),
  number: new JsTypeNumber(),
  bigint: new JsTypeBigint(),
  boolean: new JsTypeBoolean(),
  symbol: new JsTypeSymbol(),
  literal<T extends number | bigint | string | boolean | symbol>(value: T) {
    return new JsTypeLiteral(value);
  },
  array<T, R extends boolean>(item: JsType<T>, readonly: R) {
    return new JsTypeArray(item, readonly);
  },
  tuple<
    T extends readonly JsType<any>[],
    Rest extends JsType<any>,
    R extends boolean,
  >(elements: T, rest: Rest, readonly: R) {
    return new JsTypeTuple(elements, rest, readonly);
  },
  object<S extends ObjStructure, E extends boolean>(structure: S, exact: E) {
    return new JsTypeObject(structure, exact);
  },
  record<K extends PropertyKey, V>(key: JsType<K>, value: JsType<V>) {
    return new JsTypeRecord(key, value);
  },
  union<I extends readonly JsType<any>[]>(items: I) {
    return new JsTypeUnion<I>(items);
  },
  intersection<L, R>(left: JsType<L>, right: JsType<R>) {
    return new JsTypeIntersection(left, right);
  },
  function<Args extends JsTypeTuple<any, any, any>, Ret extends JsType<any>>(
    args: Args,
    ret: Ret
  ) {
    return new JsTypeFunction(args, ret);
  },
  promise<T>(item: JsType<T>) {
    return new JsTypePromise(item);
  },
  enum<T extends EnumLike>(enumeration: T) {
    return new JsTypeEnum(enumeration);
  },
  recursive<T>(fn: (that: JsTypeRecursive<T>) => JsType<T>) {
    return new JsTypeRecursive(fn);
  },
  opaque<T, B extends PropertyKey>(inner: JsType<T>, brand: B) {
    return new JsTypeOpaque(inner, brand);
  },
  instanceof<T>(clazz: Class<T>) {
    return new JsTypeInstanceof(clazz);
  },
  generic<A, T>(fn: (t: JsType<A>) => JsType<T>) {
    return fn;
  },
};
