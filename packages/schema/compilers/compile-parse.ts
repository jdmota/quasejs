import { StringBuilder } from "../../util/strings";
import { UniqueNames } from "../../util/unique-names";
import type { SchemaType } from "../schema-type";
import { isBuiltinType } from "../builtin-types";

type ParseCompileResult = { name: string; compiled: string };

export type ParseCompileCtx = Readonly<{
  name: string;
  helpers: StringBuilder;
  body: StringBuilder;
  compiler: ParseCompiler;
}>;

const helpers = {
  formatKey: `function formatKey(key) { return JSON.stringify(key); }`,
  object: [
    `const hasOwn = Object.prototype.hasOwnProperty;`,
    `const hasProp = (o, k) => hasOwn.call(o, k);`,
    `const getProp = (o, k) => (hasProp(o, k) ? o[k] : undefined);`,
    `const PROTO_KEY = "__proto__";`,
  ].join("\n"),
} as const;

export class ParseCompiler {
  readonly names: UniqueNames;
  private readonly helpers: Map<string, string>;
  private readonly compiled: Map<SchemaType, ParseCompileResult>;

  constructor() {
    this.names = new UniqueNames();
    this.helpers = new Map();
    this.compiled = new Map();
  }

  attachHelpers(kind: keyof typeof helpers) {
    this.helpers.set(kind, helpers[kind]);
  }

  compile(type: SchemaType) {
    let result = this.compiled.get(type);
    if (!result) {
      const name = this.names.new(`parse_${type.getName()}`);
      result = { name, compiled: "" };
      this.compiled.set(type, result);

      const helpers = new StringBuilder();
      const body = new StringBuilder();
      body.line(`function ${result.name}(value: unknown, ctx: Ctx) {`);
      body.indent();

      if (isBuiltinType(type)) {
        type.compileParse({
          name: result.name,
          helpers,
          body,
          compiler: this,
        });
      } else {
        // TODO
      }

      body.unindent();
      body.line(`}`);
      result.compiled = helpers.toString() + "\n" + body.toString();
    }
    return result.name;
  }

  toString() {
    let str = "";
    for (const helper of this.helpers.values()) {
      str += helper + "\n";
    }
    for (const { compiled } of this.compiled.values()) {
      str += compiled + "\n";
    }
    return str;
  }
}

export function compileParse(type: SchemaType) {
  const compiler = new ParseCompiler();
  const entryFunc = compiler.compile(type);
  return {
    entryFunc,
    contents: compiler.toString(),
  } as const;
}
