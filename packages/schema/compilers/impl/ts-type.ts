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

registry.register(SchemaAlias, (type, { typeBody, errorBody, compiler }) => {
  typeBody.add(compiler.compileType(type.target));
  errorBody.add(compiler.compileError(type.target));
});

function registerBuiltin<T extends BuiltinSchemaType>(
  clazz: Class<T>,
  impl: SchemaCompilerImpl<T, TsCompileCtx>
) {
  registry.register(clazz, (type, ctx) => {
    impl(type, ctx);
  });
}

registerBuiltin(NeverType, (type, { typeBody, errorBody, compiler }) => {
  typeBody.add(`never`);
  errorBody.add(compiler.helper("SchemaErrorTree"));
});

registerBuiltin(UnknownType, (type, { typeBody, errorBody, compiler }) => {
  typeBody.add(`unknown`);
  errorBody.add(compiler.helper("SchemaErrorTree"));
});

registerBuiltin(UndefinedType, (type, { typeBody, errorBody, compiler }) => {
  typeBody.add(`undefined`);
  errorBody.add(compiler.helper("SchemaErrorTree"));
});

registerBuiltin(NullType, (type, { typeBody, errorBody, compiler }) => {
  typeBody.add(`null`);
  errorBody.add(compiler.helper("SchemaErrorTree"));
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

registerBuiltin(LiteralType, (type, { typeBody, errorBody, compiler }) => {
  typeBody.add(toTSLiteral(type.value));
  errorBody.add(compiler.helper("SchemaErrorTree"));
});

registerBuiltin(StringType, (type, { typeBody, errorBody, compiler }) => {
  typeBody.add(`string`);
  errorBody.add(compiler.helper("SchemaErrorTree"));
});

registerBuiltin(NumberType, (type, { typeBody, errorBody, compiler }) => {
  typeBody.add(`number`);
  errorBody.add(compiler.helper("SchemaErrorTree"));
});

registerBuiltin(BigintType, (type, { typeBody, errorBody, compiler }) => {
  typeBody.add(`bigint`);
  errorBody.add(compiler.helper("SchemaErrorTree"));
});

registerBuiltin(BooleanType, (type, { typeBody, errorBody, compiler }) => {
  typeBody.add(`boolean`);
  errorBody.add(compiler.helper("SchemaErrorTree"));
});

registerBuiltin(SymbolType, (type, { typeBody, errorBody, compiler }) => {
  typeBody.add(`symbol`);
  errorBody.add(compiler.helper("SchemaErrorTree"));
});

registerBuiltin(ArrayType, (type, { typeBody, errorBody, compiler }) => {
  typeBody.add(
    `${type.readonly ? "readonly " : ""}(${compiler.compileType(type.element)})[]`
  );
  errorBody.add(
    `Readonly<{ errors: readonly ${compiler.helper("SchemaError")}[]; items: readonly (${compiler.compileError(type.element)} | undefined)[] }>`
  );
});

registerBuiltin(TupleType, (tupleType, { typeBody, errorBody, compiler }) => {
  typeBody.line(`${tupleType.readonly ? "readonly " : ""}[`);
  typeBody.indent();
  for (const { name, type, rest } of tupleType.elements) {
    typeBody.line(
      `${rest ? "..." : ""}${name}: ${compiler.compileType(type)}${rest ? "[]" : ""},`
    );
  }
  typeBody.unindent();
  typeBody.add(`]`);
  //
  errorBody.line(`Readonly<{`);
  errorBody.block(() => {
    errorBody.line(`errors: readonly ${compiler.helper("SchemaError")}[];`);
    errorBody.line(`items: readonly [`);
    errorBody.block(() => {
      for (const { name, type, rest } of tupleType.elements) {
        errorBody.line(
          `${rest ? "..." : ""}${name}: (${compiler.compileError(type)} | undefined)${rest ? "[]" : ""},`
        );
      }
    });
    errorBody.line(`];`);
  });
  errorBody.add(`}>`);
});

registerBuiltin(ObjectType, (objType, { typeBody, errorBody, compiler }) => {
  typeBody.line(`{`);
  typeBody.indent();
  for (const [name, { readonly, partial, type }] of objType.entries) {
    typeBody.line(
      `${readonly ? "readonly " : ""}${compileJsKey(name)}${partial ? "?" : ""}: ${compiler.compileType(type)};`
    );
  }
  if (objType.exact === true) {
    if (objType.entries.length === 0) {
      typeBody.line(`readonly [key in ${compiler.helper("ObjectKey")}]: never`);
    }
  } else if (objType.exact !== false) {
    typeBody.line(
      `${objType.exact.readonly ? "readonly " : ""}[key in ${compiler.compileType(objType.exact.key)}]${objType.exact.partial ? "?" : ""}: ${compiler.compileType(objType.exact.value)};`
    );
  }
  typeBody.unindent();
  typeBody.add(`}`);
  //
  errorBody.line(`Readonly<{`);
  errorBody.block(() => {
    errorBody.line(
      `errors: readonly ${compiler.helper("SchemaObjectError")}[];`
    );
    errorBody.line(`properties: Readonly<{`);
    errorBody.block(() => {
      for (const [name, { type }] of objType.entries) {
        errorBody.line(
          `${compileJsKey(name)}?: ${compiler.compileError(type)} | undefined;`
        );
      }
      if (objType.exact === true) {
        if (objType.entries.length === 0) {
          errorBody.line(`[key in ${compiler.helper("ObjectKey")}]: never`);
        }
      } else if (objType.exact !== false) {
        errorBody.line(
          `[key in ${compiler.compileType(objType.exact.key)}]?: ${compiler.compileError(objType.exact.value)};`
        );
      }
    });
    errorBody.line(`}>;`);
  });
  errorBody.add(`}>`);
});

registerBuiltin(RecordType, (type, { typeBody, errorBody, compiler }) => {
  if (type.readonly) {
    typeBody.add("Readonly<");
  }
  typeBody.add(
    `{[key in ${compiler.compileType(type.key)}]?: ${compiler.compileType(type.value)}}`
  );
  if (type.readonly) {
    typeBody.add(">");
  }
  //
  errorBody.line(`Readonly<{`);
  errorBody.block(() => {
    // Register the helper's use
    compiler.helper("SchemaRecordError<K>");
    errorBody.line(
      `errors: readonly SchemaRecordError<${compiler.compileType(type.key)}>[];`
    );
    errorBody.line(`properties: Readonly<{`);
    errorBody.block(() => {
      errorBody.line(
        `[key in ${compiler.compileType(type.key)}]?: ${compiler.compileError(type.value)};`
      );
    });
    errorBody.line(`}>;`);
  });
  errorBody.add(`}>`);
});

registerBuiltin(UnionType, (type, { typeBody, errorBody, compiler }) => {
  typeBody.add(`(${type.items.map(t => compiler.compileType(t)).join(" | ")})`);
  errorBody.add(
    `(${type.items.map(t => compiler.compileError(t)).join(" | ")})`
  );
});

registerBuiltin(IntersectionType, (type, { typeBody, errorBody, compiler }) => {
  typeBody.add(`(${type.items.map(t => compiler.compileType(t)).join(" & ")})`);
  errorBody.add(
    `(${type.items.map(t => compiler.compileError(t)).join(" | ")})`
  );
});

registerBuiltin(FunctionType, (type, { typeBody, errorBody, compiler }) => {
  typeBody.add(
    `((...args: ${compiler.compileType(type.args)}) => ${compiler.compileType(type.ret)})`
  );
  //
  errorBody.line(`Readonly<{`);
  errorBody.block(() => {
    // Register the helper's use
    compiler.helper("SchemaFunctionError<A, R>");
    errorBody.line(
      `errors: readonly SchemaFunctionError<${compiler.compileError(type.args)}, ${compiler.compileError(type.ret)}>[];`
    );
  });
  errorBody.add(`}>`);
});

registerBuiltin(EnumType, (type, { typeBody, errorBody, compiler }) => {
  typeBody.add(`${type.values.map(v => toTSLiteral(v)).join(" | ")}`);
  errorBody.add(compiler.helper("SchemaErrorTree"));
});

registerBuiltin(RecursiveType, (type, { typeBody, errorBody, compiler }) => {
  typeBody.add(compiler.compileType(type.getContentForSure()));
  errorBody.add(compiler.compileError(type.getContentForSure()));
});
