import { StringBuilder } from "../../../util/strings";

export abstract class SchemaDecorator {}

export class SchemaBuilder {
  addDecorator<D extends SchemaDecorator>(
    decorator: D
  ): DecoratoredSchemaBuilder<this, D> {
    return new DecoratoredSchemaBuilder(this, decorator);
  }
}

export class DecoratoredSchemaBuilder<
  T extends SchemaBuilder,
  D extends SchemaDecorator,
> extends SchemaBuilder {
  constructor(
    readonly target: T,
    readonly decorator: D
  ) {
    super();
  }
}

export type SchemaCompiler<S extends SchemaBuilder> = (
  schema: S,
  builder: StringBuilder
) => void;

export type TypesBuilder = {
  literal: <const T extends number | bigint | string | boolean | symbol>(
    value: T
  ) => Readonly<{
    type: "literal";
    value: T;
  }>;

  undefined: () => Readonly<{
    type: "undefined";
  }>;

  null: () => Readonly<{
    type: "null";
  }>;

  string: () => Readonly<{
    type: "string";
  }>;

  number: () => Readonly<{
    type: "number";
  }>;

  bigint: () => Readonly<{
    type: "bigint";
  }>;

  boolean: () => Readonly<{
    type: "boolean";
  }>;

  symbol: () => Readonly<{
    type: "symbol";
  }>;

  array: () => Readonly<{
    type: "array";
  }>; // TODO

  tuple: () => Readonly<{
    type: "tuple";
  }>; // TODO

  object: () => Readonly<{
    type: "object";
  }>; // TODO

  record: () => Readonly<{
    type: "record";
  }>; // TODO

  union: () => Readonly<{
    type: "union";
  }>; // TODO

  intersection: () => Readonly<{
    type: "intersection";
  }>; // TODO
};

export type TypesMap = {
  [key in keyof TypesBuilder]: ReturnType<TypesBuilder[key]>;
};

export type Types = TypesMap[keyof TypesMap];

export const t: TypesBuilder = {
  literal<const T extends number | bigint | string | boolean | symbol>(
    value: T
  ) {
    return { type: "literal", value };
  },
  undefined() {
    return { type: "undefined" };
  },
  null() {
    return { type: "null" };
  },
  string() {
    return { type: "string" };
  },
  number() {
    return { type: "number" };
  },
  bigint() {
    return { type: "bigint" };
  },
  boolean() {
    return { type: "boolean" };
  },
  symbol() {
    return { type: "symbol" };
  },
  array() {
    return { type: "array" };
  },
  tuple() {
    return { type: "tuple" };
  },
  object() {
    return { type: "object" };
  },
  record() {
    return { type: "record" };
  },
  union() {
    return { type: "union" };
  },
  intersection() {
    return { type: "intersection" };
  },
};
