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
  type ParseCompileCtx,
  parseCompilerRegistry as registry,
} from "../compile-parse";
import { SchemaAlias } from "../../schema-type";

registry.register(SchemaAlias, (type, { name, body, compiler }) => {
  body.stmt(`const ${name} = ${compiler.compile(type.target)}`);
});

function registerBuiltin<T extends BuiltinSchemaType>(
  clazz: Class<T>,
  impl: SchemaCompilerImpl<T, ParseCompileCtx>,
  checkCircular: boolean
) {
  registry.register(clazz, (type, ctx) => {
    const { compiler, name, body } = ctx;

    body.line(`const ${name} = (value, ctx) => {`);
    body.indent();

    if (checkCircular) {
      const name2 = compiler.names.new(`parse_helper_${type.getName()}`);
      body.return(`${compiler.helper("parseCircular")}(${name2}, value, ctx)`);
      body.unindent();
      body.line(`};`);
      body.line(`const ${name2} = (value, ctx) => {`);
      body.indent();
    }

    impl(type, ctx);

    body.unindent();
    body.add(`};`);
  });
}

registerBuiltin(
  NeverType,
  (type, { body }) => {
    body.return(`ctx.error("Never")`);
  },
  false
);

registerBuiltin(
  UnknownType,
  (type, { body }) => {
    body.return(`ctx.result(value)`);
  },
  true
);

registerBuiltin(
  UndefinedType,
  (type, { body }) => {
    body.return(
      `value === undefined ? ctx.result(value) : ctx.error("Value is not undefined")`
    );
  },
  false
);

registerBuiltin(
  NullType,
  (type, { body }) => {
    body.return(
      `value === null ? ctx.result(value) : ctx.error("Value is not null")`
    );
  },
  false
);

function toJSLiteral(
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
      return `Symbol.for(${JSON.stringify(value.description)})`;
    default:
      never(value);
  }
}

registerBuiltin(
  LiteralType,
  (type, { compiler, helpers, body }) => {
    const expected = compiler.names.new(`expected_${type.getName()}`);
    helpers.stmt(`const ${expected} = ${toJSLiteral(type.value)}`);
    body.return(
      `value === ${expected} ? ctx.result(${expected}) : ctx.error("Invalid literal")`
    );
  },
  false
);

registerBuiltin(
  StringType,
  (type, { body }) => {
    body.return(
      `typeof value === "string" ? ctx.result(value) : ctx.error("Value is not a string")`
    );
  },
  false
);

registerBuiltin(
  NumberType,
  (type, { body }) => {
    body.return(
      `typeof value === "number" ? ctx.result(value) : ctx.error("Value is not a number")`
    );
  },
  false
);

registerBuiltin(
  BigintType,
  (type, { body }) => {
    body.return(
      `typeof value === "bigint" ? ctx.result(value) : ctx.error("Value is not a bigint")`
    );
  },
  false
);

registerBuiltin(
  BooleanType,
  (type, { body }) => {
    body.return(
      `typeof value === "boolean" ? ctx.result(value) : ctx.error("Value is not a boolean")`
    );
  },
  false
);

registerBuiltin(
  SymbolType,
  (type, { body }) => {
    body.return(
      `typeof value === "symbol" ? ctx.result(value) : ctx.error("Value is not a symbol")`
    );
  },
  false
);

registerBuiltin(
  ArrayType,
  (type, { compiler, body }) => {
    body.line(
      `
      if (Array.isArray(value)) {
        const newArray = [];
        for (let i = 0; i < value.length; i++) {
          ctx.push(i);
          const result = ${compiler.compile(type.element)}(value[i], ctx);
          if (result.ok) newArray.push(result.value);
          ctx.pop();
          if (ctx.shouldAbort()) break;
        }
        return ctx.result(newArray);
      }
      return ctx.error("Value is not an array");`
    );
  },
  true
);

registerBuiltin(
  TupleType,
  (type, { compiler, body }) => {
    body.line(
      `
      if (
        Array.isArray(value) &&
        ${
          type.hasRest == null
            ? `${type.elements.length} === value.length`
            : `${type.elements.length} <= value.length`
        }
      ) {
        const newTuple = []; let result;`
    );
    body.indent();
    for (let i = 0; i < type.elements.length; i++) {
      body.line(
        `
        ctx.push(${i});
        result = ${compiler.compile(type.elements[i].type)}(value[${i}], ctx);
        if (result.ok) newTuple.push(result.value);
        ctx.pop();
        if (ctx.shouldAbort()) return ctx.returnErrors();`
      );
    }
    const restType = type.getRest();
    if (restType) {
      body.line(
        `
        for (let i = ${type.elements.length}; i < value.length; i++) {
          ctx.push(i);
          const result = ${compiler.compile(restType)}(value[i], ctx);
          if (result.ok) newTuple.push(result.value);
          ctx.pop();
          if (ctx.shouldAbort()) return ctx.returnErrors();
        }`
      );
    }
    body.unindent();
    body.line(
      `
        return ctx.result(newTuple);
      }
      return ctx.error("Value is not a tuple of size " + ${type.elements.length});`
    );
  },
  true
);

registerBuiltin(
  ObjectType,
  (objType, { compiler, body }) => {
    body.stmt("const object = value");
    body.line(
      `
      if (typeof object === "object" && object != null) {
        const newEntries = []; let value, decoded;`
    );
    body.indent();
    body.line(
      `
      if (${compiler.helper("hasProp")}(object, ${compiler.helper("PROTO_KEY")})) {
        ctx.addError("Object has own property __proto__");
        if (ctx.shouldAbort()) return ctx.returnErrors();
      }`
    );
    if (objType.exact !== false) {
      body.line(`const extraneousKeys = new Set(Object.keys(object));`);
    }
    for (const [key, { partial, type }] of objType.entries) {
      body.line(`ctx.push(${JSON.stringify(key)});`);
      body.line(
        `value = ${compiler.helper("getProp")}(object, ${JSON.stringify(key)});`
      );
      if (partial) {
        body.line(`if (value !== undefined) {`);
        body.indent();
      }
      body.line(
        `
        decoded = ${compiler.compile(type)}(value, ctx);
        if (decoded.ok) {
          newEntries.push([${JSON.stringify(key)}, decoded.value]);
        }`
      );
      if (partial) {
        body.unindent();
        body.line(`}`);
      }
      body.line(`ctx.pop();`);
      body.line(`if (ctx.shouldAbort()) return ctx.returnErrors();`);
      if (objType.exact !== false) {
        body.line(`extraneousKeys.delete(${JSON.stringify(key)});`);
      }
    }
    if (objType.exact === true) {
      // Strict
      body.line(
        `
        if (extraneousKeys.size > 0) {
          return ${compiler.helper("reportExtraneousKeys")}(ctx, extraneousKeys);
        }`
      );
    } else if (objType.exact === false) {
      // Strip
    } else {
      // Catch unknown keys
      body.stmt(
        `${compiler.helper("catchUnknownKeys")}(object, ctx, newEntries, extraneousKeys, ${compiler.compile(objType.exact.key)}, ${compiler.compile(objType.exact.value)}, ${objType.exact.partial})`
      );
    }
    body.unindent();
    body.line(
      `
        return ctx.result(Object.fromEntries(newEntries));
      }
      return ctx.error("Value is not an object");`
    );
  },
  true
);

registerBuiltin(
  RecordType,
  (type, { compiler, body }) => {
    body.stmt("const object = value");
    body.line(
      `
      if (typeof object === "object" && object != null) {
        if (${compiler.helper("hasProp")}(object, ${compiler.helper("PROTO_KEY")})) {
          ctx.addError("Object has own property __proto__");
          if (ctx.shouldAbort()) return ctx.returnErrors();
        }
        const newEntries = [];
        for (const [key, value] of Object.entries(object)) {
          ctx.push(key, "key");
          const keyResult = ${compiler.compile(type.key)}(key, ctx);
          ctx.pop();
          if (ctx.shouldAbort()) return ctx.returnErrors();
          ctx.push(key, "value");
          const valueResult = ${compiler.compile(type.value)}(value, ctx);
          ctx.pop();
          if (ctx.shouldAbort()) return ctx.returnErrors();
          if (keyResult.ok && valueResult.ok) {
            newEntries.push([keyResult.value, valueResult.value]);
          }
        }
        return ctx.result(Object.fromEntries(newEntries));
      }
      return ctx.error("Value is not an object");`
    );
  },
  true
);

registerBuiltin(
  UnionType,
  (type, { compiler, body }) => {
    for (const item of type.items) {
      body.line(
        `
        const itemCtx = SchemaOpCtx.new(ctx);
        const result = ${compiler.compile(item)}(value, itemCtx);
        if (itemCtx.isOK()) {
          return result;
        }`
      );
    }
    body.return(`ctx.error("Value does not belong to union")`);
  },
  false
);

registerBuiltin(
  IntersectionType,
  (type, { compiler, name, helpers, body }) => {
    throw new Error("TODO");
  },
  false
);

registerBuiltin(
  FunctionType,
  (type, { compiler, body }) => {
    // TODO support "this" checking?
    body.line(
      `
      if (typeof value === "function") {
        const lockCtx = SchemaOpCtx.new(ctx);
        return ctx.result(function (...args) {
          const newCtx = SchemaOpCtx.new(lockCtx);
          if (newCtx.shouldAbort()) return newCtx.returnErrors();
          newCtx.push(null, "arguments");
          const argsResult = ${compiler.compile(type.args)}(args, newCtx);
          newCtx.pop();
          if (!argsResult.ok) return argsResult;
          const result = Reflect.apply(value, this, argsResult.value);
          newCtx.push(null, "return");
          return ${compiler.compile(type.ret)}(result, newCtx);
        });
      }
      return ctx.error("Value is not a function");`
    );
  },
  false
);

registerBuiltin(
  EnumType,
  (type, { compiler, helpers, body }) => {
    const expected = `values_${compiler.names.new(type.getName())}`;
    helpers.stmt(`const ${expected} = ${JSON.stringify(type.values)}`);
    body.return(
      `${expected}.includes(value) ? ctx.result(value) : ctx.error("Value does not belong to enumeration")`
    );
  },
  false
);

registerBuiltin(
  RecursiveType,
  (type, { compiler, body }) => {
    body.return(`${compiler.compile(type.getContentForSure())}(value, ctx)`);
  },
  false
);
