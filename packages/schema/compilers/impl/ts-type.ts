import type { Class } from "type-fest";
import { never } from "../../../util/miscellaneous";
import {
  type BuiltinSchemaType,
  ArrayType,
  BigintType,
  BooleanType,
  EnumType,
  FunctionType,
  IntersectionType,
  LiteralType,
  NeverType,
  NullType,
  NumberType,
  ObjectType,
  RecordType,
  RecursiveType,
  StringType,
  SymbolType,
  TupleType,
  UndefinedType,
  UnionType,
  UnknownType,
} from "../../builtin-types";
import type { SchemaCompilerImpl } from "../common";
import {
  type TsCompileCtx,
  tsCompilerRegistry as registry,
} from "../compile-ts";
import { SchemaAlias } from "../../schema-type";
import { compileJsKey } from "../../../util/js-identifiers";

registry.register(SchemaAlias, (type, { name, body, compiler }) => {
  body.stmt(`type ${name} = ${compiler.compile(type.target)}`);
});

// TODO support inlining definitions

function registerBuiltin<T extends BuiltinSchemaType>(
  clazz: Class<T>,
  impl: SchemaCompilerImpl<T, TsCompileCtx>
) {
  registry.register(clazz, (type, ctx) => {
    const { name, body } = ctx;
    body.add(`type ${name} = `);
    impl(type, ctx);
    body.add(`;`);
  });
}

registerBuiltin(NeverType, (type, { body }) => {
  body.add(`never`);
});

registerBuiltin(UnknownType, (type, { body }) => {
  body.add(`unknown`);
});

registerBuiltin(UndefinedType, (type, { body }) => {
  body.add(`undefined`);
});

registerBuiltin(NullType, (type, { body }) => {
  body.add(`null`);
});

function toTSLiteral(
  value: string | number | bigint | boolean | symbol
): string {
  switch (typeof value) {
    case "string":
      return JSON.stringify(value);
    case "number":
      return value + "";
    case "bigint":
      return value + "n";
    case "boolean":
      return value + "";
    case "symbol":
      return "symbol";
    default:
      never(value);
  }
}

registerBuiltin(LiteralType, (type, { body }) => {
  body.add(toTSLiteral(type.value));
});

registerBuiltin(StringType, (type, { body }) => {
  body.add(`string`);
});

registerBuiltin(NumberType, (type, { body }) => {
  body.add(`number`);
});

registerBuiltin(BigintType, (type, { body }) => {
  body.add(`bigint`);
});

registerBuiltin(BooleanType, (type, { body }) => {
  body.add(`boolean`);
});

registerBuiltin(SymbolType, (type, { body }) => {
  body.add(`symbol`);
});

registerBuiltin(ArrayType, (type, { compiler, body }) => {
  body.add(
    `${type.readonly ? "readonly " : ""}(${compiler.compile(type.element)})[]`
  );
});

registerBuiltin(TupleType, (tupleType, { compiler, body }) => {
  body.line(`${tupleType.readonly ? "readonly " : ""}[`);
  body.indent();
  for (const { name, type, rest } of tupleType.elements) {
    body.line(
      `${rest ? "..." : ""}${name}: ${compiler.compile(type)}${rest ? "[]" : ""},`
    );
  }
  body.unindent();
  body.add(`]`);
});

registerBuiltin(ObjectType, (objType, { compiler, body }) => {
  body.line(`{`);
  body.indent();
  for (const [name, { readonly, partial, type }] of objType.entries) {
    body.line(
      `${readonly ? "readonly " : ""}${compileJsKey(name)}${partial ? "?" : ""}: ${compiler.compile(type)};`
    );
  }
  if (objType.exact === true) {
    if (objType.entries.length === 0) {
      body.line(`readonly [key in string]: never`);
    }
  } else if (objType.exact !== false) {
    body.line(
      `${objType.exact.readonly ? "readonly " : ""}[key in ${compiler.compile(objType.exact.key)}]${objType.exact.partial ? "?" : ""}: ${compiler.compile(objType.exact.value)};`
    );
  }
  body.unindent();
  body.add(`}`);
});

registerBuiltin(RecordType, (type, { compiler, body }) => {
  if (type.readonly) {
    body.add("Readonly<");
  }
  body.add(
    `{[key in ${compiler.compile(type.key)}]?: ${compiler.compile(type.value)}}`
  );
  if (type.readonly) {
    body.add(">");
  }
});

registerBuiltin(UnionType, (type, { compiler, body }) => {
  body.add(`(${type.items.map(t => compiler.compile(t)).join(" | ")})`);
});

registerBuiltin(IntersectionType, (type, { compiler, body }) => {
  body.add(`(${type.items.map(t => compiler.compile(t)).join(" & ")})`);
});

registerBuiltin(FunctionType, (type, { compiler, body }) => {
  body.add(
    `((...args: ${compiler.compile(type.args)}) => ${compiler.compile(type.ret)})`
  );
});

registerBuiltin(EnumType, (type, { compiler, body }) => {
  body.add(`${type.values.map(v => toTSLiteral(v)).join(" | ")}`);
});

registerBuiltin(RecursiveType, (type, { compiler, body }) => {
  body.add(compiler.compile(type.getContentForSure()));
});
