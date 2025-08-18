import { nonNull } from "../util/miscellaneous";
import { VALID_JS_ID } from "../util/js-identifiers";
import { UniqueNames } from "../util/unique-names";
import { SchemaType } from "./schema-type";

abstract class BuiltinSchemaType extends SchemaType {
  override getBuiltin() {
    return this;
  }
}

export type { BuiltinSchemaType };

export class NeverType extends BuiltinSchemaType {
  static build = new NeverType();

  readonly _tag = "NeverType";

  override getName() {
    return "never";
  }
}

export class UnknownType extends BuiltinSchemaType {
  static build = new UnknownType();

  readonly _tag = "UnknownType";

  override getName() {
    return "unknown";
  }
}

export class UndefinedType extends BuiltinSchemaType {
  static build = new UndefinedType();

  readonly _tag = "UndefinedType";

  override getName() {
    return "undefined";
  }
}

export class NullType extends BuiltinSchemaType {
  static build = new NullType();

  readonly _tag = "NullType";

  override getName() {
    return "null";
  }
}

export class LiteralType extends BuiltinSchemaType {
  static build(value: number | bigint | string | boolean | symbol) {
    return new LiteralType(value);
  }

  readonly _tag = "LiteralType";

  constructor(readonly value: number | bigint | string | boolean | symbol) {
    super();
    if (typeof value === "symbol") {
      if (!value.description || value !== Symbol.for(value.description)) {
        throw new Error(`Symbol should be created with Symbol.for()`);
      }
    }
  }

  override getName() {
    return "literal";
  }
}

// TODO https://www.typescriptlang.org/docs/handbook/2/template-literal-types.html
// TODO https://www.typescriptlang.org/docs/handbook/2/indexed-access-types.html

export class StringType extends BuiltinSchemaType {
  static build = new StringType();

  readonly _tag = "StringType";

  override getName() {
    return "string";
  }
}

export class NumberType extends BuiltinSchemaType {
  static build = new NumberType();

  readonly _tag = "NumberType";

  override getName() {
    return "number";
  }
}

export class BigintType extends BuiltinSchemaType {
  static build = new BigintType();

  readonly _tag = "BigintType";

  override getName() {
    return "bigint";
  }
}

export class BooleanType extends BuiltinSchemaType {
  static build = new BooleanType();

  readonly _tag = "BooleanType";

  override getName() {
    return "boolean";
  }
}

export class SymbolType extends BuiltinSchemaType {
  static build = new SymbolType();

  readonly _tag = "SymbolType";

  override getName() {
    return "symbol";
  }
}

export class ArrayType extends BuiltinSchemaType {
  static build(element: SchemaType, readonly: boolean = true) {
    return new ArrayType(element, readonly);
  }

  readonly _tag = "ArrayType";

  constructor(
    readonly element: SchemaType,
    readonly readonly: boolean
  ) {
    super();
  }

  override getName() {
    return "array";
  }
}

type TupleItemOpt =
  | SchemaType
  | Readonly<{
      name?: string;
      type: SchemaType;
      rest?: boolean;
    }>;

type TupleItem = Readonly<{
  name: string;
  type: SchemaType;
  rest: boolean;
}>;

export class TupleType extends BuiltinSchemaType {
  static build(elements: readonly TupleItemOpt[], readonly: boolean = true) {
    return new TupleType(elements, readonly);
  }

  readonly _tag = "TupleType";
  readonly readonly: boolean;
  readonly hasRest: boolean;
  readonly elements: readonly TupleItem[];

  constructor(elements: readonly TupleItemOpt[], readonly: boolean) {
    super();
    this.readonly = readonly;
    const uniqNames = new UniqueNames();
    let hasRest = false;
    for (const item of elements) {
      if (hasRest) {
        throw new Error(`Only 1 rest argument allowed at the end`);
      }
      if (!(item instanceof SchemaType)) {
        if (item.name) {
          if (!uniqNames.mark(item.name)) {
            throw new Error(`Duplicate tuple item name: ${item.name}`);
          }
          if (!VALID_JS_ID.test(item.name)) {
            throw new Error(`Invalid tuple item name: ${item.name}`);
          }
        }
        if (item.rest) {
          hasRest = true;
        }
      }
    }
    this.hasRest = hasRest;
    this.elements = elements.map((item, i) => {
      if (item instanceof SchemaType) {
        return {
          name: uniqNames.newInternal(`_arg${i}`),
          type: item,
          rest: false,
        };
      }
      return {
        name: item.name ?? uniqNames.newInternal(`_arg${i}`),
        type: item.type,
        rest: item.rest ?? false,
      };
    });
  }

  override getName() {
    return "tuple";
  }

  getRest() {
    return this.hasRest ? nonNull(this.elements.at(-1)).type : null;
  }

  *iterate(num: number) {
    for (const elem of this.elements) {
      if (!elem.rest) {
        num--;
        yield elem;
      }
    }
    const rest = this.hasRest ? this.elements.at(-1) : null;
    if (rest) {
      while (num >= 0) {
        num--;
        yield rest;
      }
    }
  }
}

type ObjStructure = {
  readonly [key: string]:
    | SchemaType
    | Readonly<{
        type: SchemaType;
        readonly?: boolean;
        partial?: boolean;
      }>;
};

type ObjEntry = Readonly<{
  readonly: boolean;
  partial: boolean;
  type: SchemaType;
}>;

type ObjEntries = readonly (readonly [string, ObjEntry])[];

type ObjEntriesRecord = Readonly<Record<string, ObjEntry | undefined>>;

type UnknownKeysOpts = Readonly<{
  key: SchemaType;
  value: SchemaType;
  readonly?: boolean;
  partial?: boolean;
}>;

type UnknownKeys = Readonly<{
  key: SchemaType;
  value: SchemaType;
  readonly: boolean;
  partial: boolean;
}>;

const hasOwn = Object.prototype.hasOwnProperty;
const hasProp = (o: any, k: string) => hasOwn.call(o, k);
const PROTO_KEY = "__proto__";

export class ObjectType extends BuiltinSchemaType {
  static build(
    structure: ObjStructure,
    exact: boolean | UnknownKeysOpts = true
  ) {
    return new ObjectType(structure, exact);
  }

  readonly _tag = "ObjectType";
  readonly entries: ObjEntries;
  readonly entriesRecord: ObjEntriesRecord;
  readonly exact: boolean | UnknownKeys;

  constructor(structure: ObjStructure, exact: boolean | UnknownKeysOpts) {
    super();
    if (hasProp(structure, PROTO_KEY)) {
      throw new Error("Object type includes __proto__ key");
    }
    this.entries = Object.entries(structure).map(([k, v]) => {
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
}

export class RecordType extends BuiltinSchemaType {
  static build(key: SchemaType, value: SchemaType, readonly = true) {
    return new RecordType(key, value, readonly);
  }

  readonly _tag = "RecordType";

  constructor(
    readonly key: SchemaType,
    readonly value: SchemaType,
    readonly readonly: boolean
  ) {
    super();
    // TODO validate kind of key: string | number | symbol
  }

  override getName() {
    return "record";
  }
}

export class UnionType extends BuiltinSchemaType {
  static build(...items: readonly SchemaType[]) {
    return new UnionType(items);
  }

  static buildOptimized(...items: readonly SchemaType[]) {
    items = items.filter(t => !(t instanceof NeverType));
    if (items.length === 0) return NeverType.build;
    if (items.length === 1) return items[0];
    return new UnionType(items);
  }

  readonly _tag = "UnionType";

  constructor(readonly items: readonly SchemaType[]) {
    super();
  }

  override getName() {
    return "union";
  }
}

export class IntersectionType extends BuiltinSchemaType {
  static build(...items: readonly SchemaType[]) {
    return new IntersectionType(items);
  }

  static buildOptimized(...items: readonly SchemaType[]) {
    items = items.filter(t => !(t instanceof UnknownType));
    if (items.length === 0) return UnknownType.build;
    if (items.length === 1) return items[0];
    return new IntersectionType(items);
  }

  readonly _tag = "IntersectionType";

  constructor(readonly items: readonly SchemaType[]) {
    super();
  }

  override getName() {
    return "intersection";
  }
}

export class FunctionType extends BuiltinSchemaType {
  static build(args: readonly TupleItemOpt[], ret: SchemaType) {
    return new FunctionType(args, ret);
  }

  readonly _tag = "FunctionType";
  readonly args: TupleType;
  readonly ret: SchemaType;

  constructor(args: readonly TupleItemOpt[], ret: SchemaType) {
    super();
    this.ret = ret;
    this.args = TupleType.build(args, true);
  }

  override getName() {
    return "function";
  }
}

type EnumLike = EnumObj | readonly string[];

type EnumObj = {
  readonly [k: string]: string | number;
};

export class EnumType extends BuiltinSchemaType {
  static build(enumeration: EnumLike) {
    return new EnumType(enumeration);
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
}

export class RecursiveType extends BuiltinSchemaType {
  static build(fn: null | ((that: RecursiveType) => SchemaType)) {
    return new RecursiveType(fn);
  }

  readonly _tag = "RecursiveType";
  private content: SchemaType | null;

  constructor(readonly fn: null | ((that: RecursiveType) => SchemaType)) {
    super();
    this.content = null;
    if (fn) {
      this.setContent(fn(this));
    }
  }

  override getName() {
    return "recursive";
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

  setContent(content: SchemaType) {
    if (this.content) {
      throw new Error(`Already set`);
    }
    this.content = content;
    if (!this.checkGuarded(this.content)) {
      throw new Error(`Recursive type circularly references itself`);
    }
  }

  private checkGuarded(_type: SchemaType): boolean {
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
      return type.items.every(t => this.checkGuarded(t));
    }
    if (type instanceof IntersectionType) {
      return type.items.every(t => this.checkGuarded(t));
    }
    return true;
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

export function isBuiltinType(schema: SchemaType): schema is BuiltinTypes {
  return schema instanceof BuiltinSchemaType;
}

export class RecursiveTypeCreator {
  private readonly rec: RecursiveType = new RecursiveType(null);
  private used = false;

  getVar() {
    this.used = true;
    return this.rec;
  }

  create(content: SchemaType) {
    if (this.used) {
      this.rec.setContent(content);
      return this.rec;
    }
    return content;
  }
}
