import { StringBuilder } from "../../util/strings";

import { type SchemaType } from "../schema-type";
import { BaseSchemaCompiler, SchemaCompilersRegistry } from "./common";

type TsCompileResult = { name: string; compiled: string };

export type TsCompileCtx = Readonly<{
  compiler: TsCompiler;
  name: string;
  helpers: StringBuilder;
  body: StringBuilder;
}>;

export const tsCompilerRegistry = new SchemaCompilersRegistry<TsCompileCtx>(
  "TS"
);

const helpers = {} as const;

export class TsCompiler extends BaseSchemaCompiler<
  typeof tsCompilerRegistry,
  keyof typeof helpers,
  TsCompileResult
> {
  constructor() {
    super(tsCompilerRegistry, helpers);
  }

  compile(type: SchemaType) {
    let result = this.compiled.get(type);
    if (!result) {
      const name = this.names.new(`type_${type.getName()}`);
      result = { name, compiled: "" };
      this.compiled.set(type, result);

      const helpers = new StringBuilder();
      const body = new StringBuilder();

      tsCompilerRegistry.compile(type, {
        name,
        helpers,
        body,
        compiler: this,
      });

      const helpersCode = helpers.toString();
      const bodyCode = body.toString();
      result.compiled = helpersCode ? helpersCode + "\n" + bodyCode : bodyCode;
    }
    return result.name;
  }

  toString() {
    let str = "";
    for (const [name, code] of this.usedHelpers) {
      str += `type ${name} = ${code};\n`;
    }
    for (const { compiled } of this.compiled.values()) {
      str += compiled + "\n";
    }
    return str;
  }
}

export function registerTsCompilers() {
  return import("./impl/ts-type");
}

export function compileTs(type: SchemaType) {
  const compiler = new TsCompiler();
  const entryName = compiler.compile(type);
  const contents = compiler.toString();
  return {
    entryName,
    contents,
  } as const;
}
