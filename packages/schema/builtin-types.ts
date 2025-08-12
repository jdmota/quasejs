import { never, nonNull } from "../util/miscellaneous";
import { UniqueNames } from "../util/unique-names";
import type { ParseCompileCtx } from "./compilers/compile-parse";
import { SchemaType } from "./schema-type";
import { SchemaOpCtx } from "./util/context";
import { formatKey } from "./util/format";
import type { ValidationResult } from "./util/result";

type Parser = (
  type: SchemaType,
  value: unknown,
  ctx: SchemaOpCtx
) => ValidationResult<unknown>;

abstract class BuiltinSchemaType extends SchemaType {
  abstract parse(
    value: unknown,
    ctx: SchemaOpCtx,
    rec: Parser
  ): ValidationResult<unknown>;

  abstract compileParse(ctx: ParseCompileCtx): void;
}

export class UnknownType extends BuiltinSchemaType {
  static build = new UnknownType();

  readonly _tag = "UnknownType";

  override getName() {
    return "unknown";
  }

  parse(value: unknown, ctx: SchemaOpCtx) {
    return ctx.result(value);
  }

  compileParse({ body }: ParseCompileCtx) {
    body.return(`ctx.result(value)`);
  }
}

export class UndefinedType extends BuiltinSchemaType {
  static build = new UndefinedType();

  readonly _tag = "UndefinedType";

  override getName() {
    return "undefined";
  }

  parse(value: unknown, ctx: SchemaOpCtx) {
    return value === undefined
      ? ctx.result(value)
      : ctx.error("Value is not undefined");
  }

  compileParse({ body }: ParseCompileCtx) {
    body.return(
      `value === undefined ? ctx.result(value) : ctx.error("Value is not undefined")`
    );
  }
}

export class NullType extends BuiltinSchemaType {
  static build = new NullType();

  readonly _tag = "NullType";

  override getName() {
    return "null";
  }

  parse(value: unknown, ctx: SchemaOpCtx) {
    return value === null ? ctx.result(value) : ctx.error("Value is not null");
  }

  compileParse({ body }: ParseCompileCtx) {
    body.return(
      `value === null ? ctx.result(value) : ctx.error("Value is not null")`
    );
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

  parse(value: unknown, ctx: SchemaOpCtx) {
    return value === this.value
      ? ctx.result(this.value)
      : ctx.error("Invalid literal");
  }

  private toJSLiteral(): string {
    switch (typeof this.value) {
      case "string":
        return JSON.stringify(this.value);
      case "number":
        return this.value + "";
      case "bigint":
        return this.value + "n";
      case "boolean":
        return this.value + "";
      case "symbol":
        return `Symbol.for(${JSON.stringify(this.value.description)})`;
      default:
        never(this.value);
    }
  }

  compileParse({ compiler, helpers, body }: ParseCompileCtx) {
    const expected = compiler.names.new(`expected_${this.getName()}`);
    helpers.stmt(`const ${expected} = ${this.toJSLiteral()}`);
    body.return(
      `value === ${expected} ? ctx.result(${expected}) : ctx.error("Invalid literal")`
    );
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

  parse(value: unknown, ctx: SchemaOpCtx) {
    return typeof value === "string"
      ? ctx.result(value)
      : ctx.error("Value is not a string");
  }

  compileParse({ body }: ParseCompileCtx) {
    body.return(
      `typeof value === "string" ? ctx.result(value) : ctx.error("Value is not a string")`
    );
  }
}

export class NumberType extends BuiltinSchemaType {
  static build = new NumberType();

  readonly _tag = "NumberType";

  override getName() {
    return "number";
  }

  parse(value: unknown, ctx: SchemaOpCtx) {
    return typeof value === "number"
      ? ctx.result(value)
      : ctx.error("Value is not a number");
  }

  compileParse({ body }: ParseCompileCtx) {
    body.return(
      `typeof value === "number" ? ctx.result(value) : ctx.error("Value is not a number")`
    );
  }
}

export class BigintType extends BuiltinSchemaType {
  static build = new BigintType();

  readonly _tag = "BigintType";

  override getName() {
    return "bigint";
  }

  parse(value: unknown, ctx: SchemaOpCtx) {
    return typeof value === "bigint"
      ? ctx.result(value)
      : ctx.error("Value is not a bigint");
  }

  compileParse({ body }: ParseCompileCtx) {
    body.return(
      `typeof value === "bigint" ? ctx.result(value) : ctx.error("Value is not a bigint")`
    );
  }
}

export class BooleanType extends BuiltinSchemaType {
  static build = new BooleanType();

  readonly _tag = "BooleanType";

  override getName() {
    return "boolean";
  }

  parse(value: unknown, ctx: SchemaOpCtx) {
    return typeof value === "boolean"
      ? ctx.result(value)
      : ctx.error("Value is not a boolean");
  }

  compileParse({ body }: ParseCompileCtx) {
    body.return(
      `typeof value === "boolean" ? ctx.result(value) : ctx.error("Value is not a boolean")`
    );
  }
}

export class SymbolType extends BuiltinSchemaType {
  static build = new SymbolType();

  readonly _tag = "SymbolType";

  override getName() {
    return "symbol";
  }

  parse(value: unknown, ctx: SchemaOpCtx) {
    return typeof value === "symbol"
      ? ctx.result(value)
      : ctx.error("Value is not a symbol");
  }

  compileParse({ body }: ParseCompileCtx) {
    body.return(
      `typeof value === "symbol" ? ctx.result(value) : ctx.error("Value is not a symbol")`
    );
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

  parse(value: unknown, ctx: SchemaOpCtx, rec: Parser) {
    if (Array.isArray(value)) {
      const newArray = [];
      for (let i = 0; i < value.length; i++) {
        ctx.push(i);
        const result = rec(this.element, value[i], ctx);
        if (result.ok) newArray.push(result.value);
        ctx.pop();
        if (ctx.shouldAbort()) break;
      }
      return ctx.result(newArray);
    }
    return ctx.error("Value is not an array");
  }

  compileParse({ compiler, body }: ParseCompileCtx) {
    body.add(`
      if (Array.isArray(value)) {
        const newArray = [];
        for (let i = 0; i < value.length; i++) {
          ctx.push(i);
          const result = ${compiler.compile(this.element)}(value[i], ctx);
          if (result.ok) newArray.push(result.value);
          ctx.pop();
          if (ctx.shouldAbort()) break;
        }
        return ctx.result(newArray);
      }
      return ctx.error("Value is not an array");
    `);
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
            throw new Error(`Duplicate tuple item name ${item.name}`);
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

  parse(value: unknown, ctx: SchemaOpCtx, rec: Parser) {
    if (
      Array.isArray(value) &&
      (this.hasRest == null
        ? this.elements.length === value.length
        : this.elements.length <= value.length)
    ) {
      const newTuple = [];
      for (let i = 0; i < this.elements.length; i++) {
        ctx.push(i);
        const result = rec(this.elements[i].type, value[i], ctx);
        if (result.ok) newTuple.push(result.value);
        ctx.pop();
        if (ctx.shouldAbort()) return ctx.returnErrors();
      }
      const restType = this.elements.at(-1)?.type;
      for (let i = this.elements.length; i < value.length; i++) {
        ctx.push(i);
        const result = rec(restType!, value[i], ctx);
        if (result.ok) newTuple.push(result.value);
        ctx.pop();
        if (ctx.shouldAbort()) return ctx.returnErrors();
      }
      return ctx.result(newTuple);
    }
    return ctx.error("Value is not a tuple of size " + this.elements.length);
  }

  compileParse({ compiler, body }: ParseCompileCtx) {
    body.add(`
      if (
        Array.isArray(value) &&
        ${
          this.hasRest == null
            ? `${this.elements.length} === value.length`
            : `${this.elements.length} <= value.length`
        }
      ) {
        const newTuple = [];
    `);
    body.indent();
    for (let i = 0; i < this.elements.length; i++) {
      body.add(`
        ctx.push(${i});
        const result = ${compiler.compile(this.elements[i].type)}(value[${i}], ctx);
        if (result.ok) newTuple.push(result.value);
        ctx.pop();
        if (ctx.shouldAbort()) return ctx.returnErrors();
      `);
    }
    if (this.hasRest) {
      const restType = nonNull(this.elements.at(-1)).type;
      body.add(`
        for (let i = ${this.elements.length}; i < value.length; i++) {
          ctx.push(i);
          const result = ${compiler.compile(restType)}(value[i], ctx);
          if (result.ok) newTuple.push(result.value);
          ctx.pop();
          if (ctx.shouldAbort()) return ctx.returnErrors();
        }
      `);
    }
    body.unindent();
    body.add(`
        return ctx.result(newTuple);
      }
      return ctx.error("Value is not a tuple of size " + ${this.elements.length});
    `);
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

type ObjEntries = readonly (readonly [
  string,
  Readonly<{
    readonly: boolean;
    partial: boolean;
    type: SchemaType;
  }>,
])[];

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
const getProp = (o: any, k: string) => (hasProp(o, k) ? o[k] : undefined);

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

  parse(object: unknown, ctx: SchemaOpCtx, rec: Parser) {
    if (typeof object === "object" && object != null) {
      const newEntries = [];
      if (hasProp(object, PROTO_KEY)) {
        ctx.addError("Object has own property __proto__");
        if (ctx.shouldAbort()) return ctx.returnErrors();
      }
      const extraneousKeys = new Set(Object.keys(object));
      for (const [key, { partial, type }] of this.entries) {
        ctx.push(key);
        const value = getProp(object, key);
        if (!partial || value !== undefined) {
          const decoded = rec(type, value, ctx);
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
          const keyResult = rec(this.exact.key, key, ctx);
          ctx.pop();
          if (ctx.shouldAbort()) return ctx.returnErrors();
          ctx.push(key, "value");
          const value = getProp(object, key);
          if (!this.exact.partial || value !== undefined) {
            const valueResult = rec(this.exact.value, value, ctx);
            if (keyResult.ok && valueResult.ok) {
              newEntries.push([keyResult.value, valueResult.value] as const);
            }
          }
          ctx.pop();
          if (ctx.shouldAbort()) return ctx.returnErrors();
        }
      }
      return ctx.result(Object.fromEntries(newEntries));
    }
    return ctx.error("Value is not an object");
  }

  compileParse({ compiler, body }: ParseCompileCtx) {
    compiler.attachHelpers("object");
    compiler.attachHelpers("formatKey");
    body.stmt("const object = value");
    body.add(`
      if (typeof object === "object" && object != null) {
        const newEntries = [];
    `);
    body.indent();
    body.add(`
        if (hasProp(object, PROTO_KEY)) {
          ctx.addError("Object has own property __proto__");
          if (ctx.shouldAbort()) return ctx.returnErrors();
        }
    `);
    if (this.exact !== false) {
      body.add(`
        const extraneousKeys = new Set(Object.keys(object));  
      `);
    }
    for (const [key, { partial, type }] of this.entries) {
      body.add(`
        ctx.push(${JSON.stringify(key)});
        const value = getProp(object, ${JSON.stringify(key)});
        if (${partial ? `value !== undefined` : `true`}) {
          const decoded = ${compiler.compile(type)}(value, ctx);
          if (decoded.ok) {
            newEntries.push([${JSON.stringify(key)}, decoded.value]);
          }
        }
        ctx.pop();
        if (ctx.shouldAbort()) return ctx.returnErrors();
      `);
      if (this.exact !== false) {
        body.add(`
          extraneousKeys.delete(${JSON.stringify(key)});
        `);
      }
    }
    if (this.exact === true) {
      body.add(`
        // Strict
        if (extraneousKeys.size > 0) {
          return ctx.error(
            \`Extraneous properties: \${Array.from(extraneousKeys)
              .map(k => formatKey(k))
              .join(", ")}\`
          );
        }
      `);
    } else if (this.exact === false) {
      // Strip
    } else {
      body.add(`
        // Catch unknown keys
        for (const key of extraneousKeys) {
          ctx.push(key, "key");
          const keyResult = ${compiler.compile(this.exact.key)}(key, ctx);
          ctx.pop();
          if (ctx.shouldAbort()) return ctx.returnErrors();
          ctx.push(key, "value");
          const value = getProp(object, key);
          if (${this.exact.partial ? `value !== undefined` : `true`}) {
            const valueResult = ${compiler.compile(this.exact.value)}(value, ctx);
            if (keyResult.ok && valueResult.ok) {
              newEntries.push([keyResult.value, valueResult.value]);
            }
          }
          ctx.pop();
          if (ctx.shouldAbort()) return ctx.returnErrors();
        }
      `);
    }
    body.unindent();
    body.add(`
        return ctx.result(Object.fromEntries(newEntries));
      }
      return ctx.error("Value is not an object");
    `);
  }
}

export class RecordType extends BuiltinSchemaType {
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

  override getName() {
    return "record";
  }

  parse(object: unknown, ctx: SchemaOpCtx, rec: Parser) {
    if (typeof object === "object" && object != null) {
      if (hasProp(object, PROTO_KEY)) {
        ctx.addError("Object has own property __proto__");
        if (ctx.shouldAbort()) return ctx.returnErrors();
      }
      const newEntries = [];
      for (const [key, value] of Object.entries(object)) {
        ctx.push(key, "key");
        const keyResult = rec(this.key, key, ctx);
        ctx.pop();
        if (ctx.shouldAbort()) return ctx.returnErrors();
        ctx.push(key, "value");
        const valueResult = rec(this.value, value, ctx);
        ctx.pop();
        if (ctx.shouldAbort()) return ctx.returnErrors();
        if (keyResult.ok && valueResult.ok) {
          newEntries.push([keyResult.value, valueResult.value] as const);
        }
      }
      return ctx.result(Object.fromEntries(newEntries));
    }
    return ctx.error("Value is not an object");
  }

  compileParse({ compiler, body }: ParseCompileCtx) {
    compiler.attachHelpers("object");
    body.stmt("const object = value");
    body.add(`
      if (typeof object === "object" && object != null) {
        if (hasProp(object, PROTO_KEY)) {
          ctx.addError("Object has own property __proto__");
          if (ctx.shouldAbort()) return ctx.returnErrors();
        }
        const newEntries = [];
        for (const [key, value] of Object.entries(object)) {
          ctx.push(key, "key");
          const keyResult = ${compiler.compile(this.key)}(key, ctx);
          ctx.pop();
          if (ctx.shouldAbort()) return ctx.returnErrors();
          ctx.push(key, "value");
          const valueResult = ${compiler.compile(this.value)}(value, ctx);
          ctx.pop();
          if (ctx.shouldAbort()) return ctx.returnErrors();
          if (keyResult.ok && valueResult.ok) {
            newEntries.push([keyResult.value, valueResult.value] as const);
          }
        }
        return ctx.result(Object.fromEntries(newEntries));
      }
      return ctx.error("Value is not an object");
    `);
  }
}

export class UnionType extends BuiltinSchemaType {
  static build(items: readonly SchemaType[]) {
    return new UnionType(items);
  }

  readonly _tag = "UnionType";

  constructor(readonly items: readonly SchemaType[]) {
    super();
  }

  override getName() {
    return "union";
  }

  parse(value: unknown, ctx: SchemaOpCtx, rec: Parser) {
    for (const item of this.items) {
      const itemCtx = SchemaOpCtx.new(ctx);
      const result = rec(item, value, itemCtx);
      if (itemCtx.isOK()) {
        return result;
      }
    }
    return ctx.error("Value does not belong to union");
  }

  compileParse({ compiler, body }: ParseCompileCtx) {
    for (const item of this.items) {
      body.add(`
        const itemCtx = SchemaOpCtx.new(ctx);
        const result = ${compiler.compile(item)}(value, itemCtx);
        if (itemCtx.isOK()) {
          return result;
        }
      `);
    }
    body.return(`ctx.error("Value does not belong to union")`);
  }
}

export class IntersectionType extends BuiltinSchemaType {
  static build(items: readonly SchemaType[]) {
    return new IntersectionType(items);
  }

  readonly _tag = "IntersectionType";

  constructor(readonly items: readonly SchemaType[]) {
    super();
  }

  override getName() {
    return "intersection";
  }

  parse(value: unknown, ctx: SchemaOpCtx, rec: Parser): never {
    throw new Error("TODO");
  }

  compileParse({ body }: ParseCompileCtx) {
    throw new Error("TODO");
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

  // TODO support this checking?

  parse(value: unknown, ctx: SchemaOpCtx, rec: Parser) {
    if (typeof value === "function") {
      const lockCtx = SchemaOpCtx.new(ctx);
      const funcType = this;
      return ctx.result(function (this: unknown, ...args: any[]) {
        const newCtx = SchemaOpCtx.new(lockCtx);
        /* newCtx.push(null, "this");
        const thisResult = funcType.thisS.par(this, newCtx);
        newCtx.pop(); */
        if (newCtx.shouldAbort()) return newCtx.returnErrors();
        newCtx.push(null, "arguments");
        const argsResult = rec(funcType.args, args, newCtx);
        newCtx.pop();
        if (/* !thisResult.ok || */ !argsResult.ok) return argsResult;
        const result = Reflect.apply(
          value,
          /* thisResult.value */ this,
          argsResult.value as any[]
        );
        newCtx.push(null, "return");
        return rec(funcType.ret, result, newCtx);
      });
    }
    return ctx.error("Value is not a function");
  }

  compileParse({ compiler, body }: ParseCompileCtx) {
    body.add(`
      if (typeof value === "function") {
        const lockCtx = SchemaOpCtx.new(ctx);
        return ctx.result(function (...args) {
          const newCtx = SchemaOpCtx.new(lockCtx);
          if (newCtx.shouldAbort()) return newCtx.returnErrors();
          newCtx.push(null, "arguments");
          const argsResult = ${compiler.compile(this.args)}(args, newCtx);
          newCtx.pop();
          if (!argsResult.ok) return argsResult;
          const result = Reflect.apply(value, this, argsResult.value);
          newCtx.push(null, "return");
          return ${compiler.compile(this.ret)}(result, newCtx);
        });
      }
      return ctx.error("Value is not a function");
    `);
  }
}

type EnumLike = {
  readonly [k: string]: string | number;
};

export class EnumType extends BuiltinSchemaType {
  static build(enumeration: EnumLike) {
    return new EnumType(enumeration);
  }

  readonly _tag = "EnumType";
  readonly values: readonly (string | number)[];

  constructor(readonly enumeration: EnumLike) {
    super();
    this.values = Object.values(enumeration);
  }

  override getName() {
    return "enum";
  }

  parse(value: unknown, ctx: SchemaOpCtx) {
    return this.values.includes(value as any)
      ? ctx.result(value)
      : ctx.error("Value does not belong to enumeration");
  }

  compileParse({ compiler, helpers, body }: ParseCompileCtx) {
    const expected = `values_${compiler.names.new(this.getName())}`;
    helpers.stmt(`const ${expected} = ${JSON.stringify(this.values)}`);
    body.return(
      `${expected}.includes(value) ? ctx.result(value) : ctx.error("Value does not belong to enumeration")`
    );
  }
}

export class RecursiveType extends BuiltinSchemaType {
  static build(fn: (that: RecursiveType) => SchemaType) {
    return new RecursiveType(fn);
  }

  readonly _tag = "RecursiveType";
  public readonly content: SchemaType;

  constructor(readonly fn: (that: RecursiveType) => SchemaType) {
    super();
    this.content = fn(this);
  }

  override getName() {
    return "recursive";
  }

  parse(value: unknown, ctx: SchemaOpCtx, rec: Parser) {
    return rec(this.content, value, ctx);
  }

  compileParse({ compiler, body }: ParseCompileCtx) {
    body.return(`${compiler.compile(this.content)}(value, ctx)`);
  }
}

// TODO generics

export const builtin = {
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
