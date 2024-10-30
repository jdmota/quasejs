import { type Class } from "../../../../util/miscellaneous";
import { SchemaInput, SchemaOutput, SchemaType } from "../schema";
import { SchemaOpCtx as Ctx, SchemaOpCtxOpts } from "../util/context";
import { formatKey } from "../util/format";
import { ValidationResult } from "../util/result";

export abstract class JsType<In, Out> extends SchemaType<In, Out> {
  constructor(public readonly type: string) {
    super();
  }

  override getDecorators() {
    return { description: null, form: null };
  }
}

export abstract class JsTypeCircularCheck<In, Out> extends JsType<In, Out> {
  override par(value: unknown, ctx: Ctx): ValidationResult<Out> {
    if (ctx.pushValue(value, this)) {
      const r = this.parImpl(value, ctx);
      ctx.popValue(value);
      return r;
    }
    return ctx.error(
      ctx.allowCircular
        ? "Parsing a circular reference with the same type"
        : "Circular reference disallowed"
    );
  }

  protected abstract parImpl(value: unknown, ctx: Ctx): ValidationResult<Out>;
}

type MaybeReadonly<T, R extends boolean> = R extends false ? T : Readonly<T>;

export class JsTypeLiteral<
  const T extends number | bigint | string | boolean | symbol,
> extends JsType<T, T> {
  constructor(public readonly value: T) {
    super("literal");
  }

  override getInputType() {
    return this;
  }

  override par(value: unknown, ctx: Ctx) {
    if (value === this.value) {
      return ctx.result(this.value);
    }
    return ctx.error("Invalid literal");
  }
}

export function literal<
  const T extends number | bigint | string | boolean | symbol,
>(value: T) {
  return new JsTypeLiteral(value);
}

export class JsTypeVoid extends JsTypeCircularCheck<void, void> {
  constructor() {
    super("void");
  }

  override getInputType() {
    return this;
  }

  protected parImpl(value: unknown, ctx: Ctx) {
    if (value === undefined) {
      return ctx.result(value);
    }
    return ctx.error("Value is not undefined");
  }
}

export const voidT = new JsTypeVoid();

export class JsTypeAny extends JsTypeCircularCheck<any, any> {
  constructor() {
    super("any");
  }

  override getInputType() {
    return this;
  }

  protected parImpl(value: unknown, ctx: Ctx) {
    return ctx.result(value);
  }
}

export const any = new JsTypeAny();

export class JsTypeUnknown extends JsTypeCircularCheck<unknown, unknown> {
  constructor() {
    super("unknown");
  }

  override getInputType() {
    return this;
  }

  protected parImpl(value: unknown, ctx: Ctx) {
    return ctx.result(value);
  }
}

export const unknown = new JsTypeUnknown();

export class JsTypeNever extends JsType<never, never> {
  constructor() {
    super("never");
  }

  override getInputType() {
    return this;
  }

  override par(value: unknown, ctx: Ctx) {
    return ctx.error("Never");
  }
}

export const never = new JsTypeNever();

export class JsTypeUndefined extends JsType<undefined, undefined> {
  constructor() {
    super("undefined");
  }

  override getInputType() {
    return this;
  }

  override par(value: unknown, ctx: Ctx) {
    if (value === undefined) {
      return ctx.result(value);
    }
    return ctx.error("Value is not undefined");
  }
}

export const undefinedT = new JsTypeUndefined();

export class JsTypeNull extends JsType<null, null> {
  constructor() {
    super("null");
  }

  override getInputType() {
    return this;
  }

  override par(value: unknown, ctx: Ctx) {
    if (value === null) {
      return ctx.result(value);
    }
    return ctx.error("Value is not null");
  }
}

export const nullT = new JsTypeNull();

export class JsTypeString extends JsType<string, string> {
  constructor() {
    super("string");
  }

  override getInputType() {
    return this;
  }

  override par(value: unknown, ctx: Ctx) {
    if (typeof value === "string") {
      return ctx.result(value);
    }
    return ctx.error("Value is not a string");
  }
}

export const string = new JsTypeString();

export class JsTypeNumber extends JsType<number, number> {
  constructor() {
    super("number");
  }

  override getInputType() {
    return this;
  }

  override par(value: unknown, ctx: Ctx) {
    if (typeof value === "number") {
      return ctx.result(value);
    }
    return ctx.error("Value is not a number");
  }
}

export const number = new JsTypeNumber();

export class JsTypeBigint extends JsType<bigint, bigint> {
  constructor() {
    super("bigint");
  }

  override getInputType() {
    return this;
  }

  override par(value: unknown, ctx: Ctx) {
    if (typeof value === "bigint") {
      return ctx.result(value);
    }
    return ctx.error("Value is not a bigint");
  }
}

export const bigint = new JsTypeBigint();

export class JsTypeBoolean extends JsType<boolean, boolean> {
  constructor() {
    super("boolean");
  }

  override getInputType() {
    return this;
  }

  override par(value: unknown, ctx: Ctx) {
    if (typeof value === "boolean") {
      return ctx.result(value);
    }
    return ctx.error("Value is not a boolean");
  }
}

export const boolean = new JsTypeBoolean();

export class JsTypeSymbol extends JsType<symbol, symbol> {
  constructor() {
    super("symbol");
  }

  override getInputType() {
    return this;
  }

  override par(value: unknown, ctx: Ctx) {
    if (typeof value === "symbol") {
      return ctx.result(value);
    }
    return ctx.error("Value is not a symbol");
  }
}

export const symbol = new JsTypeSymbol();

export class JsTypeArray<
  const T extends SchemaType<any, any>,
  const R extends boolean,
> extends JsTypeCircularCheck<
  MaybeReadonly<SchemaInput<T>[], R>,
  MaybeReadonly<SchemaOutput<T>[], R>
> {
  constructor(
    public readonly element: T,
    public readonly readonly: R
  ) {
    super("array");
  }

  override getInputType() {
    return new JsTypeArray(this.element.getInputType(), this.readonly);
  }

  protected parImpl(
    value: unknown,
    ctx: Ctx
  ): ValidationResult<SchemaOutput<this>> {
    if (Array.isArray(value)) {
      const newArray: SchemaOutput<T>[] = [];
      for (let i = 0; i < value.length; i++) {
        ctx.push(i);
        const result = this.element.par(value[i], ctx);
        if (result.ok) newArray.push(result.value);
        ctx.pop();
        if (ctx.shouldAbort()) break;
      }
      return ctx.result(newArray);
    }
    return ctx.error("Value is not an array");
  }
}

export function array<const T extends SchemaType<any, any>>(
  item: T
): JsTypeArray<T, true>;
export function array<
  const T extends SchemaType<any, any>,
  const R extends boolean,
>(item: T, readonly: R): JsTypeArray<T, R>;
export function array(item: any, readonly: any = true) {
  return new JsTypeArray(item, readonly);
}

export class JsTypeTuple<
  const T extends readonly SchemaType<any, any>[],
  const Rest extends SchemaType<any, any> | null,
  const R extends boolean,
> extends JsTypeCircularCheck<
  MaybeReadonly<
    Rest extends SchemaType<any, any>
      ? [...{ [K in keyof T]: SchemaInput<T[K]> }, ...SchemaInput<Rest>[]]
      : { [K in keyof T]: SchemaInput<T[K]> },
    R
  >,
  MaybeReadonly<
    Rest extends SchemaType<any, any>
      ? [...{ [K in keyof T]: SchemaOutput<T[K]> }, ...SchemaOutput<Rest>[]]
      : { [K in keyof T]: SchemaOutput<T[K]> },
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

  override getInputType() {
    return new JsTypeTuple(
      this.elements.map(t => t.getInputType()),
      this.rest?.getInputType() ?? null,
      this.readonly
    );
  }

  protected parImpl(
    value: unknown,
    ctx: Ctx
  ): ValidationResult<SchemaOutput<this>> {
    if (
      Array.isArray(value) &&
      (this.rest == null
        ? this.elements.length === value.length
        : this.elements.length <= value.length)
    ) {
      const newTuple = [];
      for (let i = 0; i < this.elements.length; i++) {
        ctx.push(i);
        const result = this.elements[i].par(value[i], ctx);
        if (result.ok) newTuple.push(result.value);
        ctx.pop();
        if (ctx.shouldAbort()) return ctx.returnErrors();
      }
      for (let i = this.elements.length; i < value.length; i++) {
        ctx.push(i);
        const result = this.rest!.par(value[i], ctx);
        if (result.ok) newTuple.push(result.value);
        ctx.pop();
        if (ctx.shouldAbort()) return ctx.returnErrors();
      }
      return ctx.result(newTuple as any);
    }
    return ctx.error("Value is not a tuple of size " + this.elements.length);
  }
}

export function tuple<const T extends readonly SchemaType<any, any>[]>(
  elements: T
): JsTypeTuple<T, null, true>;
export function tuple<
  const T extends readonly SchemaType<any, any>[],
  const Rest extends SchemaType<any, any>,
>(elements: T, rest: Rest): JsTypeTuple<T, Rest, true>;
export function tuple<
  const T extends readonly SchemaType<any, any>[],
  const Rest extends SchemaType<any, any> | null,
  const R extends boolean,
>(elements: T, rest: Rest, readonly: R): JsTypeTuple<T, Rest, R>;
export function tuple(elements: any, rest: any = null, readonly: any = true) {
  return new JsTypeTuple(elements, rest, readonly);
}

type ObjStructure = {
  readonly [key: string]: Readonly<{
    readonly: boolean;
    partial: boolean;
    type: SchemaType<any, any>;
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

type ExtractInputTypeFromObj<
  S extends ObjStructure,
  E extends boolean | UnknownKeys,
> = {
  readonly [K in ExtractReadonlyPartial<S>]?: SchemaInput<S[K]["type"]>;
} & {
  readonly [K in ExtractReadonly<S>]: SchemaInput<S[K]["type"]>;
} & {
  [K in ExtractPartial<S>]?: SchemaInput<S[K]["type"]>;
} & {
  [K in ExtractNotReadPartial<S>]: SchemaInput<S[K]["type"]>;
} & (E extends UnknownKeys
    ? E["readonly"] extends false
      ? E["partial"] extends false
        ? { [key in SchemaInput<E["key"]>]: SchemaInput<E["value"]> }
        : { [key in SchemaInput<E["key"]>]?: SchemaInput<E["value"]> }
      : E["partial"] extends false
        ? { readonly [key in SchemaInput<E["key"]>]: SchemaInput<E["value"]> }
        : {
            readonly [key in SchemaInput<E["key"]>]?: SchemaInput<E["value"]>;
          }
    : {});

type ExtractOutputTypeFromObj<
  S extends ObjStructure,
  E extends boolean | UnknownKeys,
> = {
  readonly [K in ExtractReadonlyPartial<S>]?: SchemaOutput<S[K]["type"]>;
} & {
  readonly [K in ExtractReadonly<S>]: SchemaOutput<S[K]["type"]>;
} & {
  [K in ExtractPartial<S>]?: SchemaOutput<S[K]["type"]>;
} & {
  [K in ExtractNotReadPartial<S>]: SchemaOutput<S[K]["type"]>;
} & (E extends UnknownKeys
    ? E["readonly"] extends false
      ? E["partial"] extends false
        ? { [key in SchemaOutput<E["key"]>]: SchemaOutput<E["value"]> }
        : { [key in SchemaOutput<E["key"]>]?: SchemaOutput<E["value"]> }
      : E["partial"] extends false
        ? { readonly [key in SchemaOutput<E["key"]>]: SchemaOutput<E["value"]> }
        : {
            readonly [key in SchemaOutput<E["key"]>]?: SchemaOutput<E["value"]>;
          }
    : {});

const hasOwn = Object.prototype.hasOwnProperty;
const hasProp = (o: any, k: string) => hasOwn.call(o, k);
const getProp = (o: any, k: string) => (hasProp(o, k) ? o[k] : undefined);

const PROTO_KEY = "__proto__";

type UnknownKeys = Readonly<{
  key: SchemaType<any, any>;
  value: SchemaType<any, any>;
  readonly: boolean;
  partial: boolean;
}>;

export class JsTypeObject<
  const S extends ObjStructure,
  const E extends boolean | UnknownKeys,
> extends JsTypeCircularCheck<
  ExtractInputTypeFromObj<S, E>,
  ExtractOutputTypeFromObj<S, E>
> {
  public readonly entries: readonly [
    string,
    Readonly<{
      readonly: boolean;
      partial: boolean;
      type: SchemaType<any, any>;
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

  override getInputType() {
    return new JsTypeObject(
      Object.fromEntries(
        this.entries.map(([key, entry]) => [
          key,
          {
            ...entry,
            type: entry.type.getInputType(),
          },
        ])
      ),
      typeof this.exact === "boolean"
        ? this.exact
        : {
            key: this.exact.key.getInputType(),
            value: this.exact.value.getInputType(),
            readonly: this.exact.readonly,
            partial: this.exact.partial,
          }
    );
  }

  protected parImpl(
    object: unknown,
    ctx: Ctx
  ): ValidationResult<SchemaOutput<this>> {
    if (typeof object === "object" && object != null) {
      const newEntries = [];
      const extraneousKeys = new Set(Object.keys(object));
      if (extraneousKeys.has(PROTO_KEY)) {
        ctx.addError("Object has own property __proto__");
        if (ctx.shouldAbort()) return ctx.returnErrors();
      }
      for (const [key, { partial, type }] of this.entries) {
        ctx.push(key);
        const value = getProp(object, key);
        if (!partial || value !== undefined) {
          const decoded = type.par(value, ctx);
          if (decoded.ok) {
            newEntries.push([key, decoded.value] as const);
          }
        }
        ctx.pop();
        if (ctx.shouldAbort()) return ctx.returnErrors();
        extraneousKeys.delete(key);
      }
      if (this.exact === true) {
        // Strict
        if (extraneousKeys.size > 0) {
          return ctx.error(
            `Extraneous properties: ${Array.from(extraneousKeys)
              .map(k => formatKey(k))
              .join(", ")}`
          );
        }
      } else if (this.exact === false) {
        // Strip
      } else {
        // Catch unknown keys
        for (const key of extraneousKeys) {
          ctx.push(key, "key");
          const keyResult = this.exact.key.par(key, ctx);
          ctx.pop();
          if (ctx.shouldAbort()) return ctx.returnErrors();
          ctx.push(key, "value");
          const value = getProp(object, key);
          if (!this.exact.partial || value !== undefined) {
            const valueResult = this.exact.value.par(value, ctx);
            if (keyResult.ok && valueResult.ok) {
              newEntries.push([keyResult.value, valueResult.value] as const);
            }
          }
          ctx.pop();
          if (ctx.shouldAbort()) return ctx.returnErrors();
        }
      }
      return ctx.result(Object.fromEntries(newEntries) as any);
    }
    return ctx.error("Value is not an object");
  }
}

export function object<const S extends ObjStructure>(
  structure: S
): JsTypeObject<S, true>;
export function object<
  const S extends ObjStructure,
  const E extends true | UnknownKeys,
>(structure: S, exact: E): JsTypeObject<S, E>;
export function object(structure: any, exact: any = true) {
  return new JsTypeObject(structure, exact);
}

export class JsTypeRecord<
  const K extends SchemaType<any, any>,
  const V extends SchemaType<any, any>,
> extends JsTypeCircularCheck<
  Record<SchemaInput<K>, SchemaInput<V>>,
  Record<SchemaOutput<K>, SchemaOutput<V>>
> {
  constructor(
    public readonly key: K,
    public readonly value: V
  ) {
    super("record");
  }

  override getInputType() {
    return new JsTypeRecord(this.key.getInputType(), this.value.getInputType());
  }

  protected parImpl(
    object: unknown,
    ctx: Ctx
  ): ValidationResult<SchemaOutput<this>> {
    if (typeof object === "object" && object != null) {
      if (hasProp(object, PROTO_KEY)) {
        ctx.addError("Object has own property __proto__");
        if (ctx.shouldAbort()) return ctx.returnErrors();
      }
      const newEntries = [];
      for (const [key, value] of Object.entries(object)) {
        ctx.push(key, "key");
        const keyResult = this.key.par(key, ctx);
        ctx.pop();
        if (ctx.shouldAbort()) return ctx.returnErrors();
        ctx.push(key, "false");
        const valueResult = this.value.par(value, ctx);
        ctx.pop();
        if (ctx.shouldAbort()) return ctx.returnErrors();
        if (keyResult.ok && valueResult.ok) {
          newEntries.push([keyResult.value, valueResult.value] as const);
        }
      }
      return ctx.result(Object.fromEntries(newEntries) as any);
    }
    return ctx.error("Value is not an object");
  }
}

export function record<
  const K extends SchemaType<any, any>,
  const V extends SchemaType<any, any>,
>(key: K, value: V) {
  return new JsTypeRecord(key, value);
}

export class JsTypeUnion<
  const I extends readonly SchemaType<any, any>[],
> extends JsType<
  {
    [K in keyof I]: SchemaInput<I[K]>;
  }[number],
  {
    [K in keyof I]: SchemaOutput<I[K]>;
  }[number]
> {
  constructor(public readonly items: I) {
    super("union");
  }

  override getInputType() {
    return new JsTypeUnion(this.items.map(t => t.getInputType()));
  }

  override par(value: unknown, ctx: Ctx): ValidationResult<SchemaOutput<this>> {
    for (const item of this.items) {
      const itemCtx = Ctx.new(ctx);
      const result = item.par(value, itemCtx);
      if (itemCtx.isOK()) {
        return result;
      }
    }
    return ctx.error("Value does not belong to union");
  }
}

export function union<const I extends readonly SchemaType<any, any>[]>(
  items: I
) {
  return new JsTypeUnion<I>(items);
}

export class JsTypeIntersection<
  const L extends SchemaType<any, any>,
  const R extends SchemaType<any, any>,
> extends JsType<
  SchemaInput<L> & SchemaInput<R>,
  SchemaOutput<L> & SchemaOutput<R>
> {
  constructor(
    public readonly left: L,
    public readonly right: R
  ) {
    super("intersection");
  }

  override getInputType() {
    return new JsTypeIntersection(
      this.left.getInputType(),
      this.right.getInputType()
    );
  }

  override par(): ValidationResult<SchemaOutput<this>> {
    throw new Error("TODO"); // TODO
  }
}

export function intersection<
  const L extends SchemaType<any, any>,
  const R extends SchemaType<any, any>,
>(left: L, right: R) {
  return new JsTypeIntersection(left, right);
}

export class JsTypeFunction<
  const Args extends JsTypeTuple<any, any, any>,
  const Ret extends SchemaType<any, any>,
  const This extends SchemaType<any, any>,
> extends JsType<
  (this: SchemaOutput<This>, ...args: SchemaOutput<Args>) => SchemaInput<Ret>,
  (
    this: SchemaInput<This>,
    ...args: SchemaInput<Args>
  ) => ValidationResult<SchemaOutput<Ret>>
> {
  constructor(
    public readonly args: Args,
    public readonly ret: Ret,
    public readonly thisS: This
  ) {
    super("function");
  }

  override getInputType() {
    return new JsTypeFunction(this.args, this.ret.getInputType(), this.thisS);
  }

  override par(value: unknown, ctx: Ctx): ValidationResult<SchemaOutput<this>> {
    if (typeof value === "function") {
      return ctx.result(this._implement(value, Ctx.new(ctx)));
    }
    return ctx.error("Value is not a function");
  }

  private _implement(value: Function, ctx: Ctx): SchemaOutput<this> {
    const funcType = this;
    return function (this: unknown, ...args: any[]) {
      const newCtx = Ctx.new(ctx);
      newCtx.push(null, "this");
      const thisResult = funcType.thisS.par(this, newCtx);
      newCtx.pop();
      if (newCtx.shouldAbort()) return newCtx.returnErrors();
      newCtx.push(null, "arguments");
      const argsResult = funcType.args.par(args, newCtx);
      newCtx.pop();
      if (!thisResult.ok || !argsResult.ok) return argsResult;
      const result = Reflect.apply(value, thisResult.value, argsResult.value);
      newCtx.push(null, "return");
      return funcType.ret.par(result, newCtx);
    };
  }

  implement(
    value: SchemaInput<this>,
    ctx: SchemaOpCtxOpts = {}
  ): SchemaOutput<this> {
    return this._implement(value, Ctx.new(ctx));
  }
}

export function func<
  const Args extends JsTypeTuple<any, any, any>,
  const Ret extends SchemaType<any, any>,
>(args: Args, ret: Ret): JsTypeFunction<Args, Ret, JsTypeVoid>;
export function func<
  const Args extends JsTypeTuple<any, any, any>,
  const Ret extends SchemaType<any, any>,
  const This extends SchemaType<any, any>,
>(args: Args, ret: Ret, thisS: This): JsTypeFunction<Args, Ret, This>;
export function func(
  args: JsTypeTuple<any, any, any>,
  ret: SchemaType<any, any>,
  thisS: SchemaType<any, any> = voidT
) {
  return new JsTypeFunction(args, ret, thisS);
}

export class JsTypePromise<const T extends SchemaType<any, any>> extends JsType<
  Promise<SchemaInput<T>>,
  Promise<ValidationResult<SchemaOutput<T>>>
> {
  constructor(public readonly item: T) {
    super("promise");
  }

  override getInputType() {
    return new JsTypePromise(this.item.getInputType());
  }

  override par(value: unknown, ctx: Ctx): ValidationResult<SchemaOutput<this>> {
    if (value instanceof Promise) {
      const newCtx = Ctx.new(ctx);
      return ctx.result(value.then(v => this.item.par(v, newCtx)));
    }
    return ctx.error("Value is not a promise");
  }

  implement(
    fn: (
      resolve: (value: SchemaInput<T>) => void,
      reject: (err: any) => void
    ) => void,
    ctx: SchemaOpCtxOpts = {}
  ): SchemaOutput<this> {
    const newCtx = Ctx.new(ctx);
    return new Promise(fn).then(v => this.item.par(v, newCtx));
  }
}

export function promise<const T extends SchemaType<any, any>>(item: T) {
  return new JsTypePromise(item);
}

type EnumLike = {
  readonly [k: string]: string | number;
};

export class JsTypeEnum<const T extends EnumLike> extends JsType<
  T[keyof T],
  T[keyof T]
> {
  private values: readonly (string | number)[];

  constructor(public readonly enumeration: T) {
    super("enum");
    this.values = Object.values(enumeration);
  }

  override getInputType() {
    return this;
  }

  override par(value: unknown, ctx: Ctx): ValidationResult<T[keyof T]> {
    if (this.values.includes(value as any)) {
      return ctx.result(value as any);
    }
    return ctx.error("Value does not belong to enumeration");
  }
}

export function enumeration<const T extends EnumLike>(enumeration: T) {
  return new JsTypeEnum(enumeration);
}

export class JsTypeInstanceOf<const T> extends JsTypeCircularCheck<T, T> {
  constructor(public readonly clazz: Class<T>) {
    super("instanceof");
  }

  override getInputType() {
    return this;
  }

  protected parImpl(
    value: unknown,
    ctx: Ctx
  ): ValidationResult<SchemaOutput<this>> {
    if (value instanceof this.clazz) {
      return ctx.result(value);
    }
    return ctx.error("Value is not an instanceof " + this.clazz.name);
  }
}

export function instanceOf<const T>(clazz: Class<T>) {
  return new JsTypeInstanceOf(clazz);
}

export class JsTypeRecursive<
  const T extends SchemaType<any, any>,
> extends JsType<SchemaInput<T>, SchemaOutput<T>> {
  public readonly content: T;
  private constructing: boolean;

  constructor(public readonly fn: (that: JsTypeRecursive<T>) => T) {
    super("recursive");
    this.constructing = true;
    this.content = fn(this);
    this.constructing = false;
  }

  override getInputType() {
    return this.constructing
      ? this
      : new JsTypeRecursive(that => this.fn(that as any).getInputType());
  }

  override par(value: unknown, ctx: Ctx): ValidationResult<SchemaOutput<this>> {
    return this.content.par(value, ctx);
  }
}

export function recursive<const Out, const In = Out>(
  fn: (that: JsTypeRecursive<SchemaType<In, Out>>) => SchemaType<In, Out>
) {
  return new JsTypeRecursive(fn);
}

export function generic<const A, const T>(
  fn: (t: SchemaType<unknown, A>) => SchemaType<unknown, T>
) {
  return fn;
}
