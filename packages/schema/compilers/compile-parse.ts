import { StringBuilder } from "../../util/strings";
import { UniqueNames } from "../../util/unique-names";
import {
  SchemaAlias,
  SchemaWithDecorator,
  type SchemaType,
} from "../schema-type";
import { isBuiltinType, requiresCircularCheck } from "../builtin-types";

type ParseCompileResult = { name: string; compiled: string };

export type ParseCompileCtx = Readonly<{
  name: string;
  helpers: StringBuilder;
  body: StringBuilder;
  compiler: ParseCompiler;
}>;

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

export class ParseCompiler {
  readonly names: UniqueNames;
  private readonly helpers: Map<string, string>;
  private readonly compiled: Map<SchemaType, ParseCompileResult>;

  constructor() {
    this.names = new UniqueNames(Object.keys(helpers));
    this.helpers = new Map();
    this.compiled = new Map();
  }

  helper(kind: keyof typeof helpers) {
    if (!this.helpers.has(kind)) {
      const helper = helpers[kind];
      if (typeof helper === "string") {
        this.helpers.set(kind, helper);
      } else {
        for (const dep of helper.dependencies) {
          this.helper(dep);
        }
        this.helpers.set(kind, helper.code);
      }
    }
    return kind;
  }

  compile(type: SchemaType) {
    let result = this.compiled.get(type);
    if (!result) {
      const name = this.names.new(`parse_${type.getName()}`);
      result = { name, compiled: "" };
      this.compiled.set(type, result);

      const helpers = new StringBuilder();
      const body = new StringBuilder();

      if (isBuiltinType(type)) {
        body.line(`const ${result.name} = (value, ctx) => {`);
        body.indent();

        if (requiresCircularCheck(type)) {
          const name2 = this.names.new(`parse_helper_${type.getName()}`);
          body.return(`${this.helper("parseCircular")}(${name2}, value, ctx)`);
          body.unindent();
          body.line(`};`);
          body.line(`const ${name2} = (value, ctx) => {`);
          body.indent();
        }

        type.compileParse({
          name: result.name,
          helpers,
          body,
          compiler: this,
        });

        body.unindent();
        body.add(`};`);
      } else if (type instanceof SchemaWithDecorator) {
        body.stmt(`const ${result.name} = ${this.compile(type.target)}`);
      } else if (type instanceof SchemaAlias) {
        body.stmt(`const ${result.name} = ${this.compile(type.target)}`);
      } else {
        // TODO thing better about how to support extensions...
        body.line(`const ${result.name} = (value, ctx) => {`);
        body.indent();
        type.compile("Parse", {
          name: result.name,
          helpers,
          body,
          compiler: this,
        });
        body.unindent();
        body.add(`};`);
      }

      result.compiled = helpers.toString() + "\n" + body.toString();
    }
    return result.name;
  }

  toString() {
    let str = "";
    for (const [name, code] of this.helpers) {
      str += `const ${name} = ${code};\n`;
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
