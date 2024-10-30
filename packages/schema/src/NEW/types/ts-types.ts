import { type Class } from "../../../../util/miscellaneous";

export class TsTypeCompiler {
  private readonly declarations: Map<
    TsType<any>,
    { name: string; compiled: string }
  >;
  private uuid: number;

  constructor(private readonly prefix: string) {
    this.declarations = new Map();
    this.uuid = 0;
  }

  private newName() {
    return `${this.prefix}_${this.uuid++}`;
  }

  compile(type: TsType<any>) {
    if (type.inline()) {
      return type.compile(this);
    }
    const curr = this.declarations.get(type);
    if (curr) {
      return curr.name;
    }
    const name = this.newName();
    this.declarations.set(type, { name, compiled: name });
    const compiled = type.compile(this);
    this.declarations.set(type, { name, compiled });
    return name;
  }
}

const TYPE = Symbol();

export abstract class TsType<T> {
  readonly [TYPE]!: T;
  constructor(public readonly type: string) {}

  inline() {
    return false;
  }

  abstract compile(c: TsTypeCompiler): string;
}

type TsTypeUnwrap<T extends TsType<any>> = T[typeof TYPE];

type MaybeReadonly<T, R extends boolean> = R extends false ? T : Readonly<T>;

export class TsTypeLiteral<
  const T extends number | bigint | string | boolean | symbol,
> extends TsType<T> {
  constructor(public readonly value: T) {
    super("literal");
  }

  override inline() {
    return true;
  }

  compile() {
    const { value } = this;
    if (typeof value === "string") {
      return JSON.stringify(value);
    }
    if (typeof value === "symbol") {
      return "unique symbol";
    }
    if (typeof value === "bigint") {
      return value + "n";
    }
    return (value as number | boolean) + "";
  }
}

export function literal<
  const T extends number | bigint | string | boolean | symbol,
>(value: T) {
  return new TsTypeLiteral(value);
}

// TODO https://www.typescriptlang.org/docs/handbook/2/template-literal-types.html
// TODO https://www.typescriptlang.org/docs/handbook/2/indexed-access-types.html

export class TsTypeVoid extends TsType<void> {
  constructor() {
    super("void");
  }

  override inline() {
    return true;
  }

  compile() {
    return "void";
  }
}

export const voidT = new TsTypeVoid();

export class TsTypeAny extends TsType<any> {
  constructor() {
    super("any");
  }

  override inline() {
    return true;
  }

  compile() {
    return "any";
  }
}

export const any = new TsTypeAny();

export class TsTypeUnknown extends TsType<unknown> {
  constructor() {
    super("unknown");
  }

  override inline() {
    return true;
  }

  compile() {
    return "unknown";
  }
}

export const unknown = new TsTypeUnknown();

export class TsTypeNever extends TsType<never> {
  constructor() {
    super("never");
  }

  override inline() {
    return true;
  }

  compile() {
    return "never";
  }
}

export const never = new TsTypeNever();

export class TsTypeUndefined extends TsType<undefined> {
  constructor() {
    super("undefined");
  }

  override inline() {
    return true;
  }

  compile() {
    return "undefined";
  }
}

export const undefinedT = new TsTypeUndefined();

export class TsTypeNull extends TsType<null> {
  constructor() {
    super("null");
  }

  override inline() {
    return true;
  }

  compile() {
    return "null";
  }
}

export const nullT = new TsTypeNull();

export class TsTypeString extends TsType<string> {
  constructor() {
    super("string");
  }

  override inline() {
    return true;
  }

  compile() {
    return "string";
  }
}

export const string = new TsTypeString();

export class TsTypeNumber extends TsType<number> {
  constructor() {
    super("number");
  }

  override inline() {
    return true;
  }

  compile() {
    return "number";
  }
}

export const number = new TsTypeNumber();

export class TsTypeBigint extends TsType<bigint> {
  constructor() {
    super("bigint");
  }

  override inline() {
    return true;
  }

  compile() {
    return "bigint";
  }
}

export const bigint = new TsTypeBigint();

export class TsTypeBoolean extends TsType<boolean> {
  constructor() {
    super("boolean");
  }

  override inline() {
    return true;
  }

  compile() {
    return "boolean";
  }
}

export const boolean = new TsTypeBoolean();

export class TsTypeSymbol extends TsType<symbol> {
  constructor() {
    super("symbol");
  }

  override inline() {
    return true;
  }

  compile() {
    return "symbol";
  }
}

export const symbol = new TsTypeSymbol();

export class TsTypeArray<
  const T extends TsType<any>,
  const R extends boolean,
> extends TsType<MaybeReadonly<TsTypeUnwrap<T>[], R>> {
  constructor(
    public readonly element: T,
    public readonly readonly: R
  ) {
    super("array");
  }

  compile(c: TsTypeCompiler) {
    return `${this.readonly ? "readonly " : ""}${c.compile(this.element)}[]`;
  }
}

export function array<const T extends TsType<any>>(
  item: T
): TsTypeArray<T, true>;
export function array<const T extends TsType<any>, const R extends boolean>(
  item: T,
  readonly: R
): TsTypeArray<T, R>;
export function array(item: any, readonly: boolean = true) {
  return new TsTypeArray(item, readonly);
}

export class TsTypeTuple<
  const T extends readonly TsType<any>[],
  const Rest extends TsType<any> | null,
  const R extends boolean,
> extends TsType<
  MaybeReadonly<
    Rest extends TsType<any>
      ? [...{ [K in keyof T]: TsTypeUnwrap<T[K]> }, ...TsTypeUnwrap<Rest>[]]
      : { [K in keyof T]: TsTypeUnwrap<T[K]> },
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

  compile(c: TsTypeCompiler) {
    const elems = this.elements.map(e => e.compile(c)).join(", ");
    const rest = this.rest ? "..." + this.rest.compile(c) : "";
    return `${this.readonly ? "readonly " : ""}[${elems}${this.elements.length > 0 && this.rest ? ", " : ""}${rest}]`;
  }
}

export function tuple<const T extends readonly TsType<any>[]>(
  elements: T
): TsTypeTuple<T, null, true>;
export function tuple<
  const T extends readonly TsType<any>[],
  const Rest extends TsType<any>,
>(elements: T, rest: Rest): TsTypeTuple<T, Rest, true>;
export function tuple<
  const T extends readonly TsType<any>[],
  const Rest extends TsType<any> | null,
  const R extends boolean,
>(elements: T, rest: Rest, readonly: R): TsTypeTuple<T, Rest, R>;
export function tuple(
  elements: any,
  rest: any = null,
  readonly: boolean = true
) {
  return new TsTypeTuple(elements, rest, readonly);
}

type ObjStructure = {
  readonly [key: string]: Readonly<{
    readonly: boolean;
    partial: boolean;
    type: TsType<any>;
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

type ExtractOutputTypeFromObj<
  S extends ObjStructure,
  E extends boolean | UnknownKeys,
> = {
  readonly [K in ExtractReadonlyPartial<S>]?: TsTypeUnwrap<S[K]["type"]>;
} & {
  readonly [K in ExtractReadonly<S>]: TsTypeUnwrap<S[K]["type"]>;
} & {
  [K in ExtractPartial<S>]?: TsTypeUnwrap<S[K]["type"]>;
} & {
  [K in ExtractNotReadPartial<S>]: TsTypeUnwrap<S[K]["type"]>;
} & (E extends UnknownKeys
    ? E["readonly"] extends false
      ? E["partial"] extends false
        ? { [key in TsTypeUnwrap<E["key"]>]: TsTypeUnwrap<E["value"]> }
        : { [key in TsTypeUnwrap<E["key"]>]?: TsTypeUnwrap<E["value"]> }
      : E["partial"] extends false
        ? { readonly [key in TsTypeUnwrap<E["key"]>]: TsTypeUnwrap<E["value"]> }
        : {
            readonly [key in TsTypeUnwrap<E["key"]>]?: TsTypeUnwrap<E["value"]>;
          }
    : {});

const hasOwn = Object.prototype.hasOwnProperty;
const hasProp = (o: any, k: string) => hasOwn.call(o, k);
const getProp = (o: any, k: string) => (hasProp(o, k) ? o[k] : undefined);

const PROTO_KEY = "__proto__";

type UnknownKeys = Readonly<{
  key: TsType<any>;
  value: TsType<any>;
  readonly: boolean;
  partial: boolean;
}>;

export class TsTypeObject<
  const S extends ObjStructure,
  const E extends boolean | UnknownKeys,
> extends TsType<ExtractOutputTypeFromObj<S, E>> {
  public readonly entries: readonly [
    string,
    Readonly<{
      readonly: boolean;
      partial: boolean;
      type: TsType<any>;
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

  compile(c: TsTypeCompiler) {
    const entries = this.entries.map(
      ([key, { readonly, partial, type }]) =>
        `${readonly ? "readonly " : ""}${JSON.stringify(key)}${partial ? "?" : ""}: ${type.compile(c)}`
    );
    if (typeof this.exact === "object") {
      const { key, value, readonly, partial } = this.exact;
      entries.push(
        `${readonly ? "readonly " : ""}[key in ${key.compile(c)}]${partial ? "?" : ""}: ${value.compile(c)}`
      );
    }
    return `{ ${entries.join(", ")} }`;
  }
}

export function object<const S extends ObjStructure>(
  structure: S
): TsTypeObject<S, true>;
export function object<
  const S extends ObjStructure,
  const E extends true | UnknownKeys,
>(structure: S, exact: E): TsTypeObject<S, E>;
export function object(structure: any, exact: any = true) {
  return new TsTypeObject(structure, exact);
}

export class TsTypeRecord<
  const K extends TsType<any>,
  const V extends TsType<any>,
> extends TsType<Record<TsTypeUnwrap<K>, TsTypeUnwrap<V>>> {
  constructor(
    public readonly key: K,
    public readonly value: V
  ) {
    super("record");
  }

  compile(c: TsTypeCompiler) {
    const { key, value } = this;
    return `Record<${key.compile(c)}, ${value.compile(c)}>`;
  }
}

export function record<
  const K extends TsType<any>,
  const V extends TsType<any>,
>(key: K, value: V) {
  return new TsTypeRecord(key, value);
}

export class TsTypeUnion<const I extends readonly TsType<any>[]> extends TsType<
  {
    [K in keyof I]: TsTypeUnwrap<I[K]>;
  }[number]
> {
  constructor(public readonly items: I) {
    super("union");
  }

  compile(c: TsTypeCompiler) {
    return this.items.map(i => i.compile(c)).join(" | ");
  }
}

export function union<const I extends readonly TsType<any>[]>(items: I) {
  return new TsTypeUnion<I>(items);
}

export class TsTypeIntersection<
  const L extends TsType<any>,
  const R extends TsType<any>,
> extends TsType<TsTypeUnwrap<L> & TsTypeUnwrap<R>> {
  constructor(
    public readonly left: L,
    public readonly right: R
  ) {
    super("intersection");
  }

  compile(c: TsTypeCompiler) {
    return [this.left, this.right].map(i => i.compile(c)).join(" & ");
  }
}

export function intersection<
  const L extends TsType<any>,
  const R extends TsType<any>,
>(left: L, right: R) {
  return new TsTypeIntersection(left, right);
}

export class TsTypeFunction<
  const Args extends TsTypeTuple<any, any, any>,
  const Ret extends TsType<any>,
  const This extends TsType<any>,
> extends TsType<
  (this: TsTypeUnwrap<This>, ...args: TsTypeUnwrap<Args>) => TsTypeUnwrap<Ret>
> {
  constructor(
    public readonly args: Args,
    public readonly ret: Ret,
    public readonly thisS: This
  ) {
    super("function");
  }

  compile(c: TsTypeCompiler) {
    const { args, ret, thisS } = this;
    return `((this: ${thisS.compile(c)}, ...${args.compile(c)}) => ${ret.compile(c)})`;
  }
}

export function func<
  const Args extends TsTypeTuple<any, any, any>,
  const Ret extends TsType<any>,
>(args: Args, ret: Ret): TsTypeFunction<Args, Ret, TsTypeVoid>;
export function func<
  const Args extends TsTypeTuple<any, any, any>,
  const Ret extends TsType<any>,
  const This extends TsType<any>,
>(args: Args, ret: Ret, thisS: This): TsTypeFunction<Args, Ret, This>;
export function func(
  args: TsTypeTuple<any, any, any>,
  ret: TsType<any>,
  thisS: TsType<any> = voidT
) {
  return new TsTypeFunction(args, ret, thisS);
}

export class TsTypePromise<const T extends TsType<any>> extends TsType<
  Promise<TsTypeUnwrap<T>>
> {
  constructor(public readonly item: T) {
    super("promise");
  }

  compile(c: TsTypeCompiler) {
    return `Promise<${this.item.compile(c)}>`;
  }
}

export function promise<const T extends TsType<any>>(item: T) {
  return new TsTypePromise(item);
}

type EnumLike = {
  readonly [k: string]: string | number;
};

export class TsTypeEnum<const T extends EnumLike> extends TsType<T[keyof T]> {
  private values: readonly (string | number)[];

  constructor(public readonly enumeration: T) {
    super("enum");
    this.values = Object.values(enumeration);
  }

  compile(c: TsTypeCompiler) {
    return this.values.join(" | ");
  }
}

export function enumeration<const T extends EnumLike>(enumeration: T) {
  return new TsTypeEnum(enumeration);
}

export class TsTypeInstanceOf<const T> extends TsType<T> {
  constructor(public readonly clazz: Class<T>) {
    super("instanceof");
  }

  override inline(): boolean {
    return true;
  }

  compile() {
    return this.clazz.name || "ANONYMOUS_CLASS";
  }
}

export function instanceOf<const T>(clazz: Class<T>) {
  return new TsTypeInstanceOf(clazz);
}

export class TsTypeRecursive<const T extends TsType<any>> extends TsType<
  TsTypeUnwrap<T>
> {
  public readonly content: T;

  constructor(public readonly fn: (that: TsTypeRecursive<T>) => T) {
    super("recursive");
    this.content = fn(this);
  }

  compile(c: TsTypeCompiler) {
    return this.content.compile(c);
  }
}

export function recursive<const T>(
  fn: (that: TsTypeRecursive<TsType<T>>) => TsType<T>
) {
  return new TsTypeRecursive(fn);
}

// TODO generic declarations
// TODO generic functions

export class TsTypeGeneric<
  const Args extends readonly TsType<any>[],
  const T extends TsType<any>,
> extends TsType<TsTypeUnwrap<T>> {
  public readonly content: T;

  constructor(
    public readonly args: Args,
    public readonly fn: (...args: Args) => T
  ) {
    super("generic");
    this.content = fn(...this.args);
  }

  compile(c: TsTypeCompiler) {
    return "TODO";
  }
}

export function generic<
  const Args extends readonly TsType<any>[],
  const T extends TsType<any>,
>(args: Args, fn: (...args: Args) => T) {
  return new TsTypeGeneric(args, fn);
}
