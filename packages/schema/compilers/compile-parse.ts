import { StringBuilder } from "../../util/strings";
import { type SchemaType } from "../schema-type";
import { BaseSchemaCompiler, SchemaCompilersRegistry } from "./common";

type ParseCompileResult = { name: string; compiled: string };

export type ParseCompileCtx = Readonly<{
  compiler: ParseCompiler;
  name: string;
  helpers: StringBuilder;
  body: StringBuilder;
}>;

export const parseCompilerRegistry =
  new SchemaCompilersRegistry<ParseCompileCtx>("parse");

const helpers = {
  formatKey: `key => JSON.stringify(key)`,
  hasOwn: `Object.prototype.hasOwnProperty`,
  hasProp: {
    code: `(o, k) => hasOwn.call(o, k)`,
    dependencies: ["hasOwn"],
  },
  getProp: {
    code: `(o, k) => (hasProp(o, k) ? o[k] : undefined)`,
    dependencies: ["hasProp"],
  },
  PROTO_KEY: `"__proto__"`,
  parseCircular: new StringBuilder()
    .add(
      `
      (fn, value, ctx) => {
        if (ctx.pushValue(value)) {
          const r = fn(value, ctx);
          ctx.popValue(value);
          return r;
        }
        return ctx.error("Circular reference disallowed");
      }`
    )
    .toString(),
  reportExtraneousKeys: {
    dependencies: ["formatKey"],
    code: new StringBuilder()
      .add(
        `
        (ctx, extraneousKeys) => {
          return ctx.error(
            \`Extraneous properties: \${Array.from(extraneousKeys)
              .map(k => formatKey(k))
              .join(", ")}\`
          );
        }`
      )
      .toString(),
  },
  catchUnknownKeys: {
    dependencies: ["getProp"],
    code: new StringBuilder()
      .add(
        `
      (object, ctx, newEntries, extraneousKeys, keyParse, valueParse, partial) => {
        for (const key of extraneousKeys) {
          ctx.push(key, "key");
          const keyResult = keyParse(key, ctx);
          ctx.pop();
          if (ctx.shouldAbort()) return ctx.returnErrors();
          ctx.push(key, "value");
          const value = getProp(object, key);
          if (!partial || value !== undefined) {
            const valueResult = valueParse(value, ctx);
            if (keyResult.ok && valueResult.ok) {
              newEntries.push([keyResult.value, valueResult.value]);
            }
          }
          ctx.pop();
          if (ctx.shouldAbort()) return ctx.returnErrors();
        }
      }`
      )
      .toString(),
  },
} as const;

export class ParseCompiler extends BaseSchemaCompiler<
  typeof parseCompilerRegistry,
  keyof typeof helpers,
  ParseCompileResult
> {
  constructor() {
    super(parseCompilerRegistry, helpers);
  }

  compile(type: SchemaType) {
    let result = this.compiled.get(type);
    if (!result) {
      const name = this.names.new(`parse_${type.getName()}`);
      result = { name, compiled: "" };
      this.compiled.set(type, result);

      const helpers = new StringBuilder();
      const body = new StringBuilder();

      parseCompilerRegistry.compile(type, {
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
      str += `const ${name} = ${code};\n`;
    }
    for (const { compiled } of this.compiled.values()) {
      str += compiled + "\n";
    }
    return str;
  }
}

export function registerParseCompilers() {
  return import("./impl/parse");
}

export function compileParse(type: SchemaType) {
  const compiler = new ParseCompiler();
  const entryFunc = compiler.compile(type);
  const contents = compiler.toString();
  return {
    entryFunc,
    contents,
    makeFunc: () => {
      return new Function(
        "value",
        "ctx",
        `${contents}\nreturn ${entryFunc}(value, ctx);`
      );
    },
  } as const;
}
