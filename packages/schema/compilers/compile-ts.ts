import { StringBuilder } from "../../util/strings";
import { BuiltinSchemaType } from "../builtin-types";
import { type SchemaType } from "../schema-type";
import { BaseSchemaCompiler, SchemaCompilersRegistry } from "./common";

type TsCompileResult = { name: string; compiled: string };

export type TsCompileCtx = Readonly<{
  compiler: TsCompiler;
  name: string;
  body: StringBuilder;
}>;

export const tsCompilerRegistry = new SchemaCompilersRegistry<TsCompileCtx>(
  "TS"
);

const HELPERS = {} as const;

export class TsCompiler extends BaseSchemaCompiler<
  typeof tsCompilerRegistry,
  keyof typeof HELPERS,
  TsCompileResult
> {
  constructor() {
    super(tsCompilerRegistry, HELPERS);
  }

  compile(type: SchemaType) {
    let result = this.compiled.get(type);
    if (!result) {
      const name = this.names.new(`type_${type.getName()}`);
      result = { name, compiled: "" };
      this.compiled.set(type, result);

      const body = new StringBuilder();
      tsCompilerRegistry.compile(type, {
        name,
        body,
        compiler: this,
      });
      result.compiled = body.toString();
    }
    if (type instanceof BuiltinSchemaType && !type.isComplex()) {
      return result.compiled;
    }
    return result.name;
  }

  toString() {
    let str = new StringBuilder();
    for (const [type, { name, compiled }] of this.compiled) {
      if (type instanceof BuiltinSchemaType && !type.isComplex()) {
        continue;
      }
      str.stmt(`type ${name} = ${compiled}`);
    }
    return str.toString();
  }
}

export function registerTsCompilers() {
  return import("./impl/ts-type");
}

export function compileTs(type: SchemaType) {
  const compiler = new TsCompiler();
  const entry = compiler.compile(type);
  const contents = compiler.toString();
  return {
    entry,
    contents,
  } as const;
}
