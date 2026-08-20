import type { Option } from "../util/monads";
import {
  type AnySchema,
  type SchemaInput,
  type SchemaOutput,
  SchemaType,
} from "./schema-type";
import { SchemaOpCtx } from "./util/context";
import { formatKey } from "./util/format";
import type { ValidationResult } from "./util/result";

export abstract class BuiltinSchemaType<In, Out, Err> extends SchemaType<
  In,
  Out,
  Err
> {
  abstract isComplex(): boolean;
}

export abstract class BuiltinCircularCheck<
  In,
  Out,
  Err,
> extends BuiltinSchemaType<In, Out, Err> {
  override par(value: unknown, ctx: SchemaOpCtx): Option<Out> {
    if (ctx.pushValue(value)) {
      const r = this.parImpl(value, ctx);
      ctx.popValue(value);
      return r;
    }
    return ctx.error("circular", "Circular reference disallowed");
  }

  protected abstract parImpl(value: unknown, ctx: SchemaOpCtx): Option<Out>;
}

type MaybeReadonly<T, R extends boolean> = R extends false ? T : Readonly<T>;

export class NeverType extends BuiltinSchemaType<never, never, any> {
  static build = new NeverType();

  readonly _tag = "NeverType";

  override getName() {
    return "never";
  }

  override getBuiltin() {
    return this;
  }

  override isComplex() {
    return false;
  }

  override par(value: unknown, ctx: SchemaOpCtx): Option<never> {
    return ctx.error("invalid_type", "Never");
  }
}

export class UnknownType extends BuiltinCircularCheck<unknown, unknown, any> {
  static build = new UnknownType();

  readonly _tag = "UnknownType";

  override getName() {
    return "unknown";
  }

  override getBuiltin() {
    return this;
  }

  override isComplex() {
    return false;
  }

  protected override parImpl(
    value: unknown,
    ctx: SchemaOpCtx
  ): Option<unknown> {
    return ctx.result(value);
  }
}

export class UndefinedType extends BuiltinSchemaType<
  undefined,
  undefined,
  any
> {
  static build = new UndefinedType();

  readonly _tag = "UndefinedType";

  override getName() {
    return "undefined";
  }

  override getBuiltin() {
    return this;
  }

  override isComplex() {
    return false;
  }

  override par(value: unknown, ctx: SchemaOpCtx): Option<undefined> {
    if (value === undefined) {
      return ctx.result(value);
    }
    return ctx.error("invalid_type", "Value is not undefined");
  }
}

export class NullType extends BuiltinSchemaType<null, null, any> {
  static build = new NullType();

  readonly _tag = "NullType";

  override getName() {
    return "null";
  }

  override getBuiltin() {
    return this;
  }

  override isComplex() {
    return false;
  }

  override par(value: unknown, ctx: SchemaOpCtx): Option<null> {
    if (value === null) {
      return ctx.result(value);
    }
    return ctx.error("invalid_type", "Value is not null");
  }
}

export class LiteralType<
  const T extends number | bigint | string | boolean | symbol,
> extends BuiltinSchemaType<T, T, any> {
  static build<const T extends number | bigint | string | boolean | symbol>(
    value: T
  ) {
    return new LiteralType(value);
  }

  readonly _tag = "LiteralType";

  constructor(readonly value: T) {
    super();
  }

  override getName() {
    return "literal";
  }

  override isComplex() {
    return false;
  }

  override getBuiltin() {
    return this;
  }

  override par(value: unknown, ctx: SchemaOpCtx) {
    if (value === this.value) {
      return ctx.result(this.value);
    }
    return ctx.error("invalid_type", "Invalid literal");
  }

  checkCompilableValue() {
    if (typeof this.value === "symbol") {
      if (
        !this.value.description ||
        this.value !== Symbol.for(this.value.description)
      ) {
        throw new Error(`Symbol should be created with Symbol.for()`);
      }
    }
  }
}

// TODO https://www.typescriptlang.org/docs/handbook/2/template-literal-types.html
// TODO https://www.typescriptlang.org/docs/handbook/2/indexed-access-types.html

export class StringType extends BuiltinSchemaType<string, string, any> {
  static build = new StringType();

  readonly _tag = "StringType";

  override getName() {
    return "string";
  }

  override getBuiltin() {
    return this;
  }

  override isComplex() {
    return false;
  }

  override par(value: unknown, ctx: SchemaOpCtx): Option<string> {
    return typeof value === "string"
      ? ctx.result(value)
      : ctx.error("invalid_type", "Value is not a string");
  }
}

export class NumberType extends BuiltinSchemaType<number, number, any> {
  static build = new NumberType();

  readonly _tag = "NumberType";

  override getName() {
    return "number";
  }

  override getBuiltin() {
    return this;
  }

  override isComplex() {
    return false;
  }

  override par(value: unknown, ctx: SchemaOpCtx): Option<number> {
    return typeof value === "number"
      ? ctx.result(value)
      : ctx.error("invalid_type", "Value is not a number");
  }
}

export class BigintType extends BuiltinSchemaType<bigint, bigint, any> {
  static build = new BigintType();

  readonly _tag = "BigintType";

  override getName() {
    return "bigint";
  }

  override getBuiltin() {
    return this;
  }

  override isComplex() {
    return false;
  }

  override par(value: unknown, ctx: SchemaOpCtx): Option<bigint> {
    return typeof value === "bigint"
      ? ctx.result(value)
      : ctx.error("invalid_type", "Value is not a bigint");
  }
}

export class BooleanType extends BuiltinSchemaType<boolean, boolean, any> {
  static build = new BooleanType();

  readonly _tag = "BooleanType";

  override getName() {
    return "boolean";
  }

  override getBuiltin() {
    return this;
  }

  override isComplex() {
    return false;
  }

  override par(value: unknown, ctx: SchemaOpCtx): Option<boolean> {
    return typeof value === "boolean"
      ? ctx.result(value)
      : ctx.error("invalid_type", "Value is not a boolean");
  }
}

export class SymbolType extends BuiltinSchemaType<symbol, symbol, any> {
  static build = new SymbolType();

  readonly _tag = "SymbolType";

  override getName() {
    return "symbol";
  }

  override getBuiltin() {
    return this;
  }

  override isComplex() {
    return false;
  }

  override par(value: unknown, ctx: SchemaOpCtx): Option<symbol> {
    return typeof value === "symbol"
      ? ctx.result(value)
      : ctx.error("invalid_type", "Value is not a symbol");
  }
}

export class ArrayType<
  const T extends AnySchema,
  const R extends boolean,
> extends BuiltinCircularCheck<
  MaybeReadonly<SchemaInput<T>[], R>,
  MaybeReadonly<SchemaOutput<T>[], R>,
  any
> {
  static build<const T extends AnySchema>(element: T): ArrayType<T, true>;
  static build<const T extends AnySchema, const R extends boolean>(
    element: T,
    readonly: R
  ): ArrayType<T, R>;
  static build(element: any, readonly: any = true) {
    return new ArrayType(element, readonly);
  }

  readonly _tag = "ArrayType";

  constructor(
    readonly element: T,
    readonly readonly: R
  ) {
    super();
  }

  override getName() {
    return "array";
  }

  override getBuiltin() {
    return new ArrayType(this.element.getBuiltin(), this.readonly);
  }

  override isComplex() {
    return true;
  }

  protected override parImpl(
    value: unknown,
    ctx: SchemaOpCtx
  ): Option<MaybeReadonly<SchemaOutput<T>[], R>> {
    if (Array.isArray(value)) {
      const newArray: SchemaOutput<T>[] = [];
      for (let i = 0; i < value.length; i++) {
        ctx.push();
        const result = this.element.par(value[i], ctx);
        if (result.some) newArray.push(result.value);
        ctx.popIdx(i);
        if (ctx.shouldAbort()) break;
      }
      return ctx.result(newArray);
    }
    return ctx.error("invalid_type", "Value is not an array");
  }
}

export class TupleType<
  const T extends readonly AnySchema[],
  const Rest extends AnySchema | null,
  const R extends boolean,
> extends BuiltinCircularCheck<
  MaybeReadonly<
    Rest extends AnySchema
      ? [...{ [K in keyof T]: SchemaInput<T[K]> }, ...SchemaInput<Rest>[]]
      : { [K in keyof T]: SchemaInput<T[K]> },
    R
  >,
  MaybeReadonly<
    Rest extends AnySchema
      ? [...{ [K in keyof T]: SchemaOutput<T[K]> }, ...SchemaOutput<Rest>[]]
      : { [K in keyof T]: SchemaOutput<T[K]> },
    R
  >,
  any
> {
  static build<const T extends readonly AnySchema[]>(
    elements: T
  ): TupleType<T, null, true>;
  static build<
    const T extends readonly AnySchema[],
    const Rest extends AnySchema,
  >(elements: T, rest: Rest): TupleType<T, Rest, true>;
  static build<
    const T extends readonly AnySchema[],
    const Rest extends AnySchema | null,
    const R extends boolean,
  >(elements: T, rest: Rest, readonly: R): TupleType<T, Rest, R>;
  static build(elements: any, rest: any = null, readonly: any = true) {
    return new TupleType(elements, rest, readonly);
  }

  readonly _tag = "TupleType";

  constructor(
    public readonly elements: T,
    public readonly rest: Rest,
    public readonly readonly: R
  ) {
    super();
  }

  override getName() {
    return "tuple";
  }

  override isComplex() {
    return true;
  }

  override getBuiltin() {
    return new TupleType(
      this.elements.map(t => t.getBuiltin()),
      this.rest?.getBuiltin() ?? null,
      this.readonly
    );
  }

  *iterate(num: number) {
    for (const elem of this.elements) {
      num--;
      yield elem;
    }
    const rest = this.rest;
    if (rest) {
      while (num >= 0) {
        num--;
        yield rest;
      }
    }
  }

  protected parImpl(
    value: unknown,
    ctx: SchemaOpCtx
  ): Option<SchemaOutput<this>> {
    if (
      Array.isArray(value) &&
      (this.rest == null
        ? this.elements.length === value.length
        : this.elements.length <= value.length)
    ) {
      const newTuple = [];
      for (let i = 0; i < this.elements.length; i++) {
        ctx.push();
        const result = this.elements[i].par(value[i], ctx);
        if (result.some) newTuple.push(result.value);
        ctx.popIdx(i);
        if (ctx.shouldAbort()) return ctx.none;
      }
      for (let i = this.elements.length; i < value.length; i++) {
        ctx.push();
        const result = this.rest!.par(value[i], ctx);
        if (result.some) newTuple.push(result.value);
        ctx.popIdx(i);
        if (ctx.shouldAbort()) return ctx.none;
      }
      return ctx.result(newTuple as any);
    }
    return ctx.error(
      "invalid_type",
      `Value is not a tuple of${this.rest == null ? "" : " at least"} size " + ${this.elements.length}`
    );
  }
}

// Based on zod
type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

type ObjKey = string | symbol;

type ObjEntryOpts = Readonly<{
  type: AnySchema;
  readonly?: boolean;
  partial?: boolean;
}>;

type ObjEntry = Readonly<{
  type: AnySchema;
  readonly: boolean;
  partial: boolean;
}>;

type ObjStructure = {
  readonly [key: ObjKey]: AnySchema | ObjEntryOpts;
};

type GetReadonly<S extends ObjStructure> = {
  [K in keyof S]: S[K] extends ObjEntryOpts
    ? S[K]["readonly"] extends false
      ? never
      : S[K]["partial"] extends false
        ? K
        : never
    : S[K] extends AnySchema
      ? K
      : never;
}[keyof S];

type GetReadonlyPartial<S extends ObjStructure> = {
  [K in keyof S]: S[K] extends ObjEntryOpts
    ? S[K]["readonly"] extends false
      ? never
      : S[K]["partial"] extends false
        ? never
        : K
    : never;
}[keyof S];

type GetPartial<S extends ObjStructure> = {
  [K in keyof S]: S[K] extends ObjEntryOpts
    ? S[K]["readonly"] extends false
      ? S[K]["partial"] extends false
        ? never
        : K
      : never
    : never;
}[keyof S];

type GetNotReadonlyPartial<S extends ObjStructure> = {
  [K in keyof S]: S[K] extends ObjEntryOpts
    ? S[K]["readonly"] extends false
      ? S[K]["partial"] extends false
        ? K
        : never
      : never
    : never;
}[keyof S];

type ObjEntries = readonly (readonly [ObjKey, ObjEntry])[];

type ObjEntriesRecord = Readonly<Record<ObjKey, ObjEntry | undefined>>;

type UnknownKeysOpts = Readonly<{
  key: AnySchema;
  value: AnySchema;
  readonly?: boolean;
  partial?: boolean;
}>;

type UnknownKeys = Readonly<{
  key: AnySchema;
  value: AnySchema;
  readonly: boolean;
  partial: boolean;
}>;

type SchemaFromObjEntry<T> = T extends ObjEntryOpts ? T["type"] : T;

type GetInputTypeFromObj<
  S extends ObjStructure,
  E extends boolean | UnknownKeysOpts,
> = {
  readonly [K in GetReadonlyPartial<S>]?: SchemaInput<SchemaFromObjEntry<S[K]>>;
} & {
  readonly [K in GetReadonly<S>]: SchemaInput<SchemaFromObjEntry<S[K]>>;
} & {
  [K in GetPartial<S>]?: SchemaInput<SchemaFromObjEntry<S[K]>>;
} & {
  [K in GetNotReadonlyPartial<S>]: SchemaInput<SchemaFromObjEntry<S[K]>>;
} & (E extends UnknownKeysOpts
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

type GetOutputTypeFromObj<
  S extends ObjStructure,
  E extends boolean | UnknownKeysOpts,
> = {
  readonly [K in GetReadonlyPartial<S>]?: SchemaOutput<
    SchemaFromObjEntry<S[K]>
  >;
} & {
  readonly [K in GetReadonly<S>]: SchemaOutput<SchemaFromObjEntry<S[K]>>;
} & {
  [K in GetPartial<S>]?: SchemaOutput<SchemaFromObjEntry<S[K]>>;
} & {
  [K in GetNotReadonlyPartial<S>]: SchemaOutput<SchemaFromObjEntry<S[K]>>;
} & (E extends UnknownKeysOpts
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

export const FORBIDDEN_KEYS: ReadonlySet<string> = new Set([
  "__proto__",
  "constructor",
  "prototype",
]);

function checkForbiddenKeys(object: any, ctx: SchemaOpCtx) {
  for (const key of FORBIDDEN_KEYS) {
    if (hasProp(object, key)) {
      ctx.addError("forbidden_key", "Object has own property ${key}");
      if (ctx.shouldAbort()) return;
    }
  }
}

function reportExtraneousKeys(
  extraneousKeys: ReadonlySet<ObjKey>,
  ctx: SchemaOpCtx
) {
  return ctx.error(
    "extraneous_keys",
    `Extraneous keys: ${Array.from(extraneousKeys)
      .map(k => formatKey(k))
      .join(", ")}`
  );
}

function catchUnknownKeys(
  object: any,
  ctx: SchemaOpCtx,
  newEntries: [any, any][],
  extraneousKeys: ReadonlySet<ObjKey>,
  keyParse: AnySchema,
  valueParse: AnySchema,
  partial: boolean
) {
  for (const key of extraneousKeys) {
    ctx.push();
    const keyResult = keyParse.par(key, ctx);
    ctx.popCtx(errors => ({ code: "invalid_key", key, message: "", errors }));
    if (ctx.shouldAbort()) return ctx.none;
    ctx.push();
    const value = (object as any)[key];
    if (!partial || value !== undefined) {
      const valueResult = valueParse.par(value, ctx);
      if (keyResult.some && valueResult.some) {
        newEntries.push([keyResult.value, valueResult.value]);
      }
    }
    ctx.popKey(key);
    if (ctx.shouldAbort()) return ctx.none;
  }
}

export class ObjectType<
  const S extends ObjStructure,
  const E extends boolean | UnknownKeysOpts,
> extends BuiltinCircularCheck<
  Prettify<GetInputTypeFromObj<S, E>>,
  Prettify<GetOutputTypeFromObj<S, E>>,
  any
> {
  static build<const S extends ObjStructure>(structure: S): ObjectType<S, true>;
  static build<
    const S extends ObjStructure,
    const E extends boolean | UnknownKeysOpts,
  >(structure: S, exact: E): ObjectType<S, E>;
  static build(structure: any, exact: any = true) {
    return new ObjectType(structure, exact);
  }

  readonly _tag = "ObjectType";
  readonly entries: ObjEntries;
  readonly entriesRecord: ObjEntriesRecord;
  readonly exact: boolean | UnknownKeys;

  constructor(structure: ObjStructure, exact: boolean | UnknownKeysOpts) {
    super();
    this.entries = Object.entries(structure).map(([k, v]) => {
      if (FORBIDDEN_KEYS.has(k)) {
        throw new Error(`Object type includes ${k} key`);
      }
      if (v instanceof SchemaType) {
        return [k, { type: v, readonly: true, partial: false }];
      }
      return [
        k,
        {
          type: v.type,
          readonly: v.readonly ?? true,
          partial: v.partial ?? false,
        },
      ];
    });
    this.entriesRecord = Object.fromEntries(this.entries);
    this.exact =
      typeof exact === "boolean"
        ? exact
        : {
            key: exact.key,
            value: exact.value,
            readonly: exact.readonly ?? true,
            partial: exact.partial ?? false,
          };
  }

  override getName() {
    return "object";
  }

  override isComplex() {
    return true;
  }

  override getBuiltin() {
    return new ObjectType(
      Object.fromEntries(
        this.entries.map(([key, entry]) => [
          key,
          {
            ...entry,
            type: entry.type.getBuiltin(),
          },
        ])
      ),
      typeof this.exact === "boolean"
        ? this.exact
        : {
            key: this.exact.key.getBuiltin(),
            value: this.exact.value.getBuiltin(),
            readonly: this.exact.readonly,
            partial: this.exact.partial,
          }
    );
  }

  protected parImpl(
    object: unknown,
    ctx: SchemaOpCtx
  ): Option<SchemaOutput<this>> {
    if (typeof object === "object" && object != null) {
      const newEntries: [any, any][] = [];
      checkForbiddenKeys(object, ctx);
      if (ctx.shouldAbort()) return ctx.none;
      const extraneousKeys = new Set(Reflect.ownKeys(object));
      for (const [key, { partial, type }] of this.entries) {
        ctx.push();
        const value = (object as any)[key];
        if (!partial || value !== undefined) {
          const decoded = type.par(value, ctx);
          if (decoded.some) {
            newEntries.push([key, decoded.value] as const);
          }
        }
        ctx.popKey(key);
        if (ctx.shouldAbort()) return ctx.none;
        extraneousKeys.delete(key);
      }
      if (this.exact === true) {
        // Strict
        if (extraneousKeys.size > 0) {
          return reportExtraneousKeys(extraneousKeys, ctx);
        }
      } else if (this.exact === false) {
        // Strip
      } else {
        // Catch unknown keys
        catchUnknownKeys(
          object,
          ctx,
          newEntries,
          extraneousKeys,
          this.exact.key,
          this.exact.value,
          this.exact.partial
        );
      }
      return ctx.result(Object.fromEntries(newEntries) as any);
    }
    return ctx.error("invalid_type", "Value is not an object");
  }
}

export class RecordType<
  const K extends AnySchema,
  const V extends AnySchema,
  const R extends boolean,
> extends BuiltinCircularCheck<
  MaybeReadonly<Record<SchemaInput<K>, SchemaInput<V>>, R>,
  MaybeReadonly<Record<SchemaOutput<K>, SchemaOutput<V>>, R>,
  any
> {
  static build<const K extends AnySchema, const V extends AnySchema>(
    key: K,
    value: V
  ): RecordType<K, V, true>;
  static build<
    const K extends AnySchema,
    const V extends AnySchema,
    const R extends boolean,
  >(key: K, value: V, readonly: R): RecordType<K, V, R>;
  static build(key: any, value: any, readonly = true) {
    return new RecordType(key, value, readonly);
  }

  readonly _tag = "RecordType";

  constructor(
    readonly key: K,
    readonly value: V,
    readonly readonly: boolean
  ) {
    super();
    // TODO validate kind of key: string | number | symbol
  }

  override getName() {
    return "record";
  }

  override isComplex() {
    return true;
  }

  override getBuiltin() {
    return new RecordType(
      this.key.getBuiltin(),
      this.value.getBuiltin(),
      this.readonly
    );
  }

  protected parImpl(
    object: unknown,
    ctx: SchemaOpCtx
  ): Option<SchemaOutput<this>> {
    if (typeof object === "object" && object != null) {
      checkForbiddenKeys(object, ctx);
      if (ctx.shouldAbort()) return ctx.none;
      const newEntries = [];
      for (const key of Reflect.ownKeys(object)) {
        ctx.push();
        const keyResult = this.key.par(key, ctx);
        ctx.popCtx(errors => ({
          code: "invalid_key",
          key,
          message: "",
          errors,
        }));
        if (ctx.shouldAbort()) return ctx.none;
        ctx.push();
        const valueResult = this.value.par((object as any)[key], ctx);
        ctx.popKey(key);
        if (ctx.shouldAbort()) return ctx.none;
        if (keyResult.some && valueResult.some) {
          newEntries.push([keyResult.value, valueResult.value] as const);
        }
      }
      return ctx.result(Object.fromEntries(newEntries) as any);
    }
    return ctx.error("invalid_type", "Value is not an object");
  }
}

export class UnionType<
  const I extends readonly AnySchema[],
> extends BuiltinSchemaType<
  {
    [K in keyof I]: SchemaInput<I[K]>;
  }[number],
  {
    [K in keyof I]: SchemaOutput<I[K]>;
  }[number],
  any
> {
  static build<const I extends readonly AnySchema[]>(...items: I) {
    return new UnionType(items);
  }

  static buildOptimized<const I extends readonly AnySchema[]>(
    ..._items: I
  ): BuiltinSchemaType<
    {
      [K in keyof I]: SchemaInput<I[K]>;
    }[number],
    {
      [K in keyof I]: SchemaOutput<I[K]>;
    }[number],
    any
  > {
    const items = _items.filter(t => !(t instanceof NeverType));
    if (items.length === 0) return NeverType.build;
    if (items.length === 1) return items[0] as any;
    return new UnionType(items);
  }

  readonly _tag = "UnionType";

  constructor(readonly items: I) {
    super();
  }

  override getName() {
    return "union";
  }

  override isComplex() {
    return true;
  }

  override getBuiltin() {
    return new UnionType(this.items.map(t => t.getBuiltin()));
  }

  override par(value: unknown, ctx: SchemaOpCtx): Option<SchemaOutput<this>> {
    for (const item of this.items) {
      const itemCtx = SchemaOpCtx.new(ctx);
      const result = item.par(value, itemCtx);
      if (itemCtx.isOK()) {
        return result;
      }
    }
    return ctx.error("union", "Value does not belong to union");
  }
}

type GetIntersectionInputType<I> = I extends readonly [AnySchema, ...infer B]
  ? SchemaInput<I[0]> & GetIntersectionInputType<B>
  : unknown;

type GetIntersectionOutputType<I> = I extends readonly [AnySchema, ...infer B]
  ? SchemaOutput<I[0]> & GetIntersectionOutputType<B>
  : unknown;

export class IntersectionType<
  const I extends readonly AnySchema[],
> extends BuiltinSchemaType<
  GetIntersectionInputType<I>,
  GetIntersectionOutputType<I>,
  any
> {
  static build<const I extends readonly AnySchema[]>(...items: I) {
    return new IntersectionType(items);
  }

  static buildOptimized<const I extends readonly AnySchema[]>(
    ..._items: I
  ): BuiltinSchemaType<
    GetIntersectionInputType<I>,
    GetIntersectionOutputType<I>,
    any
  > {
    const items = _items.filter(t => !(t instanceof UnknownType));
    if (items.length === 0) return UnknownType.build as any;
    if (items.length === 1) return items[0] as any;
    return new IntersectionType(items) as any;
  }

  readonly _tag = "IntersectionType";

  constructor(readonly items: I) {
    super();
  }

  override getName() {
    return "intersection";
  }

  override isComplex() {
    return true;
  }

  override getBuiltin() {
    return new IntersectionType(this.items.map(t => t.getBuiltin()));
  }

  override par(): Option<SchemaOutput<this>> {
    throw new Error("TODO");
  }
}

export class FunctionType<
  const Args extends TupleType<any, any, any>,
  const Ret extends AnySchema,
> extends BuiltinSchemaType<
  (...args: SchemaOutput<Args>) => ValidationResult<SchemaInput<Ret>, any>,
  (...args: SchemaInput<Args>) => ValidationResult<SchemaOutput<Ret>, any>,
  any
> {
  static build<
    const Args extends TupleType<any, any, any>,
    const Ret extends AnySchema,
  >(args: Args, ret: Ret) {
    return new FunctionType(args, ret);
  }

  readonly _tag = "FunctionType";
  readonly args: Args;
  readonly ret: Ret;

  constructor(args: Args, ret: Ret) {
    super();
    this.ret = ret;
    this.args = args;
  }

  override getName() {
    return "function";
  }

  override isComplex() {
    return true;
  }

  override getBuiltin() {
    return new FunctionType(this.args, this.ret.getBuiltin());
  }

  override par(value: unknown, ctx: SchemaOpCtx): Option<SchemaOutput<this>> {
    if (typeof value === "function") {
      return ctx.result(this._implement(value, SchemaOpCtx.new(ctx)));
    }
    return ctx.error("invalid_type", "Value is not a function");
  }

  private _implement(value: Function, ctx: SchemaOpCtx): SchemaOutput<this> {
    const funcType = this;
    return function (this: any, ...args: any[]) {
      const newCtx = SchemaOpCtx.new(ctx);
      if (newCtx.shouldAbort()) return newCtx.validationResult(newCtx.none);
      newCtx.push();
      const argsResult = funcType.args.par(args, newCtx);
      newCtx.popCtx(errors => ({
        code: "function_error",
        message: "",
        where: "arguments",
        errors,
      }));
      if (!argsResult.some) return newCtx.validationResult(argsResult);
      const result = Reflect.apply(value, this, argsResult.value);
      newCtx.push();
      const retResult = funcType.ret.par(result, newCtx);
      newCtx.popCtx(errors => ({
        code: "function_error",
        message: "",
        where: "result",
        errors,
      }));
      return newCtx.validationResult(retResult);
    };
  }
}

type EnumLike = EnumObj | readonly string[];

type EnumObj = {
  readonly [k: string]: string | number;
};

export class EnumType<const T extends EnumLike> extends BuiltinSchemaType<
  T[keyof T],
  T[keyof T],
  any
> {
  static build<const T extends EnumLike>(enumeration: T) {
    return new EnumType<T>(enumeration);
  }

  readonly _tag = "EnumType";
  readonly obj: EnumObj;
  readonly values: readonly (string | number)[];

  constructor(enumeration: EnumLike) {
    super();
    this.obj = Array.isArray(enumeration)
      ? Object.fromEntries(enumeration.map((v, i) => [v, i]))
      : enumeration;
    this.values = Object.values(this.obj);
  }

  override getName() {
    return "enum";
  }

  override isComplex() {
    return true;
  }

  override getBuiltin() {
    return this;
  }

  override par(value: unknown, ctx: SchemaOpCtx): Option<T[keyof T]> {
    if (this.values.includes(value as any)) {
      return ctx.result(value as any);
    }
    return ctx.error("enum", "Value does not belong to enumeration");
  }
}

export class RecursiveType<const T extends AnySchema> extends BuiltinSchemaType<
  SchemaInput<T>,
  SchemaOutput<T>,
  any
> {
  static build<const Out, const In = Out>(
    fn:
      | null
      | ((
          that: RecursiveType<SchemaType<In, Out, any>>
        ) => SchemaType<In, Out, any>)
  ) {
    return new RecursiveType(fn);
  }

  readonly _tag = "RecursiveType";
  private content: T | null;

  constructor(readonly fn: null | ((that: RecursiveType<T>) => T)) {
    super();
    this.content = null;
    if (fn) {
      this.setContent(fn(this));
    }
  }

  override getName() {
    return "recursive";
  }

  override isComplex() {
    return true;
  }

  override getBuiltin() {
    return this;
  }

  getContent() {
    return this.content;
  }

  getContentForSure() {
    if (!this.content) {
      throw new Error(`No recursive type content`);
    }
    return this.content;
  }

  setContent(content: T) {
    if (this.content) {
      throw new Error(`Already set`);
    }
    this.content = content;
    if (!this.checkGuarded(this.content)) {
      throw new Error(`Recursive type circularly references itself`);
    }
  }

  private checkGuarded(_type: AnySchema): boolean {
    const type = _type.getBuiltin();
    if (type instanceof RecursiveType) {
      if (this === type) {
        return false;
      }
      if (type.content == null) {
        // This recursive type was not built yet
        // That is fine, it will be checked later
        return true;
      }
      return this.checkGuarded(type.content);
    }
    if (type instanceof UnionType) {
      return type.items.every((t: AnySchema) => this.checkGuarded(t));
    }
    if (type instanceof IntersectionType) {
      return type.items.every((t: AnySchema) => this.checkGuarded(t));
    }
    return true;
  }

  override par(value: unknown, ctx: SchemaOpCtx): Option<SchemaOutput<this>> {
    return this.getContentForSure().par(value, ctx);
  }
}

// TODO generics

export const builtin = {
  never: NeverType.build,
  unknown: UnknownType.build,
  undefined: UndefinedType.build,
  null: NullType.build,
  literal: LiteralType.build,
  string: StringType.build,
  number: NumberType.build,
  boolean: BooleanType.build,
  bigint: BigintType.build,
  symbol: SymbolType.build,
  array: ArrayType.build,
  tuple: TupleType.build,
  object: ObjectType.build,
  record: RecordType.build,
  union: UnionType.buildOptimized,
  inter: IntersectionType.buildOptimized,
  func: FunctionType.build,
  enum: EnumType.build,
  rec: RecursiveType.build,
} as const;

export type TypesBuilder = typeof builtin;

export type BuiltinTypesMap = {
  [key in keyof TypesBuilder]: TypesBuilder[key] extends (...args: any[]) => any
    ? ReturnType<TypesBuilder[key]>
    : TypesBuilder[key];
};

export type BuiltinTypes = BuiltinTypesMap[keyof BuiltinTypesMap];

export function isBuiltinType(schema: AnySchema): schema is BuiltinTypes {
  return schema instanceof BuiltinSchemaType;
}

export class RecursiveTypeCreator {
  private readonly rec: RecursiveType<any> = new RecursiveType(null);
  private used = false;

  getVar() {
    this.used = true;
    return this.rec;
  }

  create(content: AnySchema) {
    if (this.used) {
      this.rec.setContent(content);
      return this.rec;
    }
    return content;
  }
}
