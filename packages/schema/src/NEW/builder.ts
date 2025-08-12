import { StringBuilder } from "../../../util/strings";

export abstract class SchemaDecorator {}

export class SchemaType {
  decorator<D extends SchemaDecorator>(
    decorator: D
  ): SchemaWithDecorator<this, D> {
    return new SchemaWithDecorator(this, decorator);
  }
}

export class SchemaWithDecorator<
  T extends SchemaType,
  D extends SchemaDecorator,
> extends SchemaType {
  readonly _tag = "SchemaWithDecorator";

  constructor(
    readonly target: T,
    readonly typeDecorator: D
  ) {
    super();
  }
}

export type SchemaCompiler<S extends SchemaType> = (
  schema: S,
  builder: StringBuilder
) => void;

export class AnyType extends SchemaType {
  static build = new AnyType();
  readonly _tag = "AnyType";
}

export class UnknownType extends SchemaType {
  static build = new UnknownType();
  readonly _tag = "UnknownType";
}

export class UndefinedType extends SchemaType {
  static build = new UndefinedType();
  readonly _tag = "UndefinedType";
}

export class NullType extends SchemaType {
  static build = new NullType();
  readonly _tag = "NullType";
}

export class LiteralType extends SchemaType {
  static build(value: number | bigint | string | boolean | symbol) {
    return new LiteralType(value);
  }

  readonly _tag = "LiteralType";

  constructor(readonly value: number | bigint | string | boolean | symbol) {
    super();
  }
}

// TODO https://www.typescriptlang.org/docs/handbook/2/template-literal-types.html
// TODO https://www.typescriptlang.org/docs/handbook/2/indexed-access-types.html

export class StringType extends SchemaType {
  static build = new StringType();
  readonly _tag = "StringType";
}

export class NumberType extends SchemaType {
  static build = new NumberType();
  readonly _tag = "NumberType";
}

export class BigintType extends SchemaType {
  static build = new BigintType();
  readonly _tag = "BigintType";
}

export class BooleanType extends SchemaType {
  static build = new BooleanType();
  readonly _tag = "BooleanType";
}

export class SymbolType extends SchemaType {
  static build = new SymbolType();
  readonly _tag = "SymbolType";
}

export class ArrayType extends SchemaType {
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
}

export class TupleType extends SchemaType {
  static build(
    elements: readonly SchemaType[],
    rest: SchemaType | null = null,
    readonly: boolean = true
  ) {
    return new TupleType(elements, rest, readonly);
  }

  readonly _tag = "TupleType";

  constructor(
    readonly elements: readonly SchemaType[],
    readonly rest: SchemaType | null,
    readonly readonly: boolean
  ) {
    super();
  }
}

type ObjStructure = {
  readonly [key: string]:
    | SchemaType
    | Readonly<{
        readonly: boolean;
        partial: boolean;
        type: SchemaType;
      }>;
};

type UnknownKeys = Readonly<{
  key: SchemaType;
  value: SchemaType;
  readonly: boolean;
  partial: boolean;
}>;

const hasOwn = Object.prototype.hasOwnProperty;
const hasProp = (o: any, k: string) => hasOwn.call(o, k);
const getProp = (o: any, k: string) => (hasProp(o, k) ? o[k] : undefined);

const PROTO_KEY = "__proto__";

export class ObjectType extends SchemaType {
  static build(structure: ObjStructure, exact: boolean | UnknownKeys = true) {
    return new ObjectType(structure, exact);
  }

  readonly _tag = "ObjectType";

  constructor(
    readonly structure: ObjStructure,
    readonly exact: boolean | UnknownKeys
  ) {
    super();
    if (hasProp(structure, PROTO_KEY)) {
      throw new Error("Object type includes __proto__ key");
    }
  }
}

export class RecordType extends SchemaType {
  static build(key: SchemaType, value: SchemaType) {
    return new RecordType(key, value);
  }

  readonly _tag = "RecordType";

  constructor(
    readonly key: SchemaType,
    readonly value: SchemaType
  ) {
    super();
  }
}

export class UnionType extends SchemaType {
  static build(items: readonly SchemaType[]) {
    return new UnionType(items);
  }

  readonly _tag = "UnionType";

  constructor(readonly items: readonly SchemaType[]) {
    super();
  }
}

export class IntersectionType extends SchemaType {
  static build(items: readonly SchemaType[]) {
    return new IntersectionType(items);
  }

  readonly _tag = "IntersectionType";

  constructor(readonly items: readonly SchemaType[]) {
    super();
  }
}

type FuncArg =
  | SchemaType
  | Readonly<{
      name: string;
      type: SchemaType;
    }>;

export class FunctionType extends SchemaType {
  static build(args: readonly FuncArg[], ret: SchemaType) {
    return new FunctionType(args, ret);
  }

  readonly _tag = "FunctionType";

  constructor(
    readonly args: readonly FuncArg[],
    readonly ret: SchemaType
  ) {
    super();
  }
}

type EnumLike = {
  readonly [k: string]: string | number;
};

export class EnumType extends SchemaType {
  static build(enumeration: EnumLike) {
    return new EnumType(enumeration);
  }

  readonly _tag = "EnumType";

  constructor(readonly enumeration: EnumLike) {
    super();
  }
}

export class RecursiveType extends SchemaType {
  static build(fn: (that: RecursiveType) => SchemaType) {
    return new RecursiveType(fn);
  }

  readonly _tag = "RecursiveType";
  public readonly content: SchemaType;

  constructor(readonly fn: (that: RecursiveType) => SchemaType) {
    super();
    this.content = fn(this);
  }
}

// TODO generics

export const t = {
  any: AnyType.build,
  unknown: UnknownType.build,
  undefined: UndefinedType.build,
  null: NullType.build,
  literal: LiteralType.build,
  string: StringType.build,
  number: NumberType.build,
  bigint: BigintType.build,
  symbol: SymbolType.build,
  array: ArrayType.build,
  tuple: TupleType.build,
  object: ObjectType.build,
  record: RecordType.build,
  union: UnionType.build,
  inter: IntersectionType.build,
  func: FunctionType.build,
  enum: EnumType.build,
  rec: RecursiveType.build,
} as const;

export type TypesBuilder = typeof t;

export type TypesMap = {
  [key in keyof TypesBuilder]: TypesBuilder[key] extends (...args: any[]) => any
    ? ReturnType<TypesBuilder[key]>
    : TypesBuilder[key];
};

export type Types = TypesMap[keyof TypesMap];
