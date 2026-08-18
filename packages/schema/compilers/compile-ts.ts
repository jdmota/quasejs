import { StringBuilder } from "../../util/strings";
import { BuiltinSchemaType } from "../builtin-types";
import { type SchemaType } from "../schema-type";
import { BaseSchemaCompiler, SchemaCompilersRegistry } from "./common";

type TsCompileResult = {
  name: string;
  typeBody: string;
  errorBody: string;
  inline: boolean;
};

export type TsCompileCtx = Readonly<{
  compiler: TsCompiler;
  name: string;
  typeBody: StringBuilder;
  errorBody: StringBuilder;
  opts: { inline: boolean };
}>;

export const tsCompilerRegistry = new SchemaCompilersRegistry<TsCompileCtx>(
  "TS"
);

const HELPERS = {
  ObjectKey: `string | number | symbol`,
  SchemaError: `Readonly<{ code: string; message: string; }>`,
  SchemaErrorTree: {
    code: `Readonly<{ errors: readonly SchemaError[]; }>`,
    dependencies: ["SchemaError"],
  },
  SchemaCircularReference: `Readonly<{ code: "circular"; message: string; }>`,
  SchemaInvalidType: `Readonly<{ code: "invalid_type"; message: string; }>`,
  SchemaForbiddenKey: `Readonly<{ code: "forbidden_key"; message: string; }>`,
  SchemaExtraneousKeys: `Readonly<{ code: "extraneous_keys"; message: string; }>`,
  "SchemaInvalidKey<K>": `Readonly<{ code: "invalid_key"; key: unknown; errors: K; }>`,
  SchemaObjectError: {
    code: `SchemaCircularReference | SchemaInvalidType | SchemaForbiddenKey | SchemaExtraneousKeys`,
    dependencies: [
      "SchemaCircularReference",
      "SchemaInvalidType",
      "SchemaForbiddenKey",
      "SchemaExtraneousKeys",
    ],
  },
  "SchemaRecordError<K>": {
    code: `SchemaCircularReference | SchemaInvalidType | SchemaForbiddenKey | SchemaExtraneousKeys | SchemaInvalidKey<K>`,
    dependencies: [
      "SchemaCircularReference",
      "SchemaInvalidType",
      "SchemaForbiddenKey",
      "SchemaExtraneousKeys",
      "SchemaInvalidKey<K>",
    ],
  },
  "SchemaFunctionError<A, R>": {
    code: `Readonly<{ code: "function_error"; where: "arguments"; errors: A; }> | Readonly<{ code: "function_error"; where: "result"; errors: R; }>`,
    dependencies: [],
  },
} as const;

export class TsCompiler extends BaseSchemaCompiler<
  typeof tsCompilerRegistry,
  keyof typeof HELPERS,
  TsCompileResult
> {
  constructor() {
    super(tsCompilerRegistry, HELPERS);
  }

  private _compile(type: SchemaType) {
    let result = this.compiled.get(type);
    if (!result) {
      const opts = { inline: false };
      const name = this.names.new(`type_${type.getName()}`);
      result = { name, typeBody: "", errorBody: "", inline: false };
      this.compiled.set(type, result);

      const typeBody = new StringBuilder();
      const errorBody = new StringBuilder();
      tsCompilerRegistry.compile(type, {
        name,
        typeBody,
        errorBody,
        opts,
        compiler: this,
      });
      result.typeBody = typeBody.toString();
      result.errorBody = errorBody.toString();
      result.inline = opts.inline;
    }
    return result;
  }

  compileType(type: SchemaType): string {
    const result = this._compile(type);
    return result.inline ? result.typeBody : result.name;
  }

  compileError(type: SchemaType): string {
    const result = this._compile(type);
    return result.inline ? result.errorBody : `${result.name}$error`;
  }

  toString() {
    const str = new StringBuilder();
    for (const [name, type] of this.usedHelpers) {
      str.stmt(`type ${name} = ${type}`);
    }
    for (const [type, { name, typeBody, errorBody, inline }] of this.compiled) {
      if (!inline) {
        str.stmt(`type ${name} = ${typeBody}`);
      }
      str.stmt(`type ${name}$error = ${errorBody}`);
    }
    return str.toString();
  }

  toStringTypes() {
    const str = new StringBuilder();
    for (const [name, type] of this.usedHelpers) {
      if (name === "ObjectKey") {
        str.stmt(`type ${name} = ${type}`);
      }
    }
    for (const [type, { name, typeBody, inline }] of this.compiled) {
      if (!inline) {
        str.stmt(`type ${name} = ${typeBody}`);
      }
    }
    return str.toString();
  }
}

export function registerTsCompilers() {
  return import("./impl/ts-type");
}

export function compileTs(type: SchemaType) {
  const compiler = new TsCompiler();
  const entryType = compiler.compileType(type);
  const entryError = compiler.compileError(type);
  const contents = compiler.toString();
  return {
    entryType,
    entryError,
    contents,
  } as const;
}
