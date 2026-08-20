import { StringBuilder } from "../../util/strings";
import { FORBIDDEN_KEYS } from "../builtin-types";
import type { SchemaType, AnySchema } from "../schema-type";
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
  checkForbiddenKeys: {
    code: new StringBuilder()
      .line("(obj, ctx) => {")
      .block(s => {
        for (const key of FORBIDDEN_KEYS) {
          s.line(
            `
            if (hasProp(obj, ${JSON.stringify(key)})) {
              ctx.addError("forbidden_key", "Object has own property ${key}");
              if (ctx.shouldAbort()) return;
            }`
          );
        }
      })
      .add("}")
      .toString(),
    dependencies: ["hasProp"],
  },
  parseCircular: new StringBuilder()
    .add(
      `
      (fn, value, ctx) => {
        if (ctx.pushValue(value)) {
          const r = fn(value, ctx);
          ctx.popValue(value);
          return r;
        }
        return ctx.error("circular", "Circular reference disallowed");
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
            "extraneous_keys",
            \`Extraneous keys: \${Array.from(extraneousKeys)
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
          ctx.push();
          const keyResult = keyParse(key, ctx);
          ctx.popCtx(errors => ({code: "invalid_key", key, errors}));
          if (ctx.shouldAbort()) return ctx.none;
          ctx.push();
          const value = getProp(object, key);
          if (!partial || value !== undefined) {
            const valueResult = valueParse(value, ctx);
            if (keyResult.some && valueResult.some) {
              newEntries.push([keyResult.value, valueResult.value]);
            }
          }
          ctx.popKey(key);
          if (ctx.shouldAbort()) return ctx.none;
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

  compile(type: AnySchema) {
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

export function compileParse(type: AnySchema) {
  const compiler = new ParseCompiler();
  const entryFunc = compiler.compile(type);
  const contents = compiler.toString();
  const mainFunction = new StringBuilder()
    .line(`(value, opts) => {`)
    .block(s => {
      s.stmt(`const ctx = SchemaOpCtx.new(opts)`);
      s.stmt(`const result = ${entryFunc}(value, ctx)`);
      s.stmt(`return ctx.validationResult(result)`);
    })
    .add(`}`)
    .toString();
  const fileContents = `${contents}\nexport default ${mainFunction};\n`;
  return {
    entryFunc,
    contents,
    fileContents,
    makeFunc: () => {
      return new Function(
        "value",
        "opts",
        `${contents}\nreturn (${mainFunction})(value, opts);`
      );
    },
  } as const;
}
