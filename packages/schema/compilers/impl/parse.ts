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
    body.return(`ctx.error("invalid_type", "Never")`);
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
      `value === undefined ? ctx.result(value) : ctx.error("invalid_type", "Value is not undefined")`
    );
  },
  false
);

registerBuiltin(
  NullType,
  (type, { body }) => {
    body.return(
      `value === null ? ctx.result(value) : ctx.error("invalid_type", "Value is not null")`
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
      `value === ${expected} ? ctx.result(${expected}) : ctx.error("invalid_type", "Invalid literal")`
    );
  },
  false
);

registerBuiltin(
  StringType,
  (type, { body }) => {
    body.return(
      `typeof value === "string" ? ctx.result(value) : ctx.error("invalid_type", "Value is not a string")`
    );
  },
  false
);

registerBuiltin(
  NumberType,
  (type, { body }) => {
    body.return(
      `typeof value === "number" ? ctx.result(value) : ctx.error("invalid_type", "Value is not a number")`
    );
  },
  false
);

registerBuiltin(
  BigintType,
  (type, { body }) => {
    body.return(
      `typeof value === "bigint" ? ctx.result(value) : ctx.error("invalid_type", "Value is not a bigint")`
    );
  },
  false
);

registerBuiltin(
  BooleanType,
  (type, { body }) => {
    body.return(
      `typeof value === "boolean" ? ctx.result(value) : ctx.error("invalid_type", "Value is not a boolean")`
    );
  },
  false
);

registerBuiltin(
  SymbolType,
  (type, { body }) => {
    body.return(
      `typeof value === "symbol" ? ctx.result(value) : ctx.error("invalid_type", "Value is not a symbol")`
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
          ctx.push();
          const result = ${compiler.compile(type.element)}(value[i], ctx);
          if (result.some) newArray.push(result.value);
          ctx.popIdx(i);
          if (ctx.shouldAbort()) return ctx.none;
        }
        return ctx.result(newArray);
      }
      return ctx.error("invalid_type", "Value is not an array");`
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
        ctx.push();
        result = ${compiler.compile(type.elements[i].type)}(value[${i}], ctx);
        if (result.some) newTuple.push(result.value);
        ctx.popIdx(${i});
        if (ctx.shouldAbort()) return ctx.none;`
      );
    }
    const restType = type.getRest();
    if (restType) {
      body.line(
        `
        for (let i = ${type.elements.length}; i < value.length; i++) {
          ctx.push();
          const result = ${compiler.compile(restType)}(value[i], ctx);
          if (result.some) newTuple.push(result.value);
          ctx.popIdx(i);
          if (ctx.shouldAbort()) return ctx.none;
        }`
      );
    }
    body.unindent();
    body.line(
      `
        return ctx.result(newTuple);
      }
      return ctx.error("invalid_type", "Value is not a tuple of${type.hasRest == null ? "" : " at least"} size " + ${type.elements.length});`
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
    body.line(`${compiler.helper("checkForbiddenKeys")}(object, ctx);`);
    body.line(`if (ctx.shouldAbort()) return ctx.none;`);
    if (objType.exact !== false) {
      body.line(`const extraneousKeys = new Set(Reflect.ownKeys(object));`);
    }
    for (const [key, { partial, type }] of objType.entries) {
      body.line(`ctx.push();`);
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
        if (decoded.some) {
          newEntries.push([${JSON.stringify(key)}, decoded.value]);
        }`
      );
      if (partial) {
        body.unindent();
        body.line(`}`);
      }
      body.line(`ctx.popKey(${JSON.stringify(key)});`);
      body.line(`if (ctx.shouldAbort()) return ctx.none;`);
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
      return ctx.error("invalid_type", "Value is not an object");`
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
        ${compiler.helper("checkForbiddenKeys")}(object, ctx);
        if (ctx.shouldAbort()) return ctx.none;
        const newEntries = [];
        for (const key of Reflect.ownKeys(object)) {
          ctx.push();
          const keyResult = ${compiler.compile(type.key)}(key, ctx);
          ctx.popCtx(errors => ({code: "invalid_key", key, errors}));
          if (ctx.shouldAbort()) return ctx.none;
          ctx.push();
          const valueResult = ${compiler.compile(type.value)}(object[key], ctx);
          ctx.popKey(key);
          if (ctx.shouldAbort()) return ctx.none;
          if (keyResult.some && valueResult.some) {
            newEntries.push([keyResult.value, valueResult.value]);
          }
        }
        return ctx.result(Object.fromEntries(newEntries));
      }
      return ctx.error("invalid_type", "Value is not an object");`
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
    body.return(`ctx.error("invalid_type", "Value does not belong to union")`);
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

// TODO is this what we want? if we are "parsing" a function given by a user
// we want to check the return value, the arguments, we are the ones giving...
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
          if (newCtx.shouldAbort()) return newCtx.none;
          newCtx.push();
          const argsResult = ${compiler.compile(type.args)}(args, newCtx);
          newCtx.popCtx(errors => ({code: "function_error", where: "arguments", errors}));
          if (!argsResult.some) return argsResult;
          const ret = Reflect.apply(value, this, argsResult.value);
          newCtx.push();
          const retResult = ${compiler.compile(type.ret)}(ret, newCtx);
          newCtx.popCtx(errors => ({code: "function_error", where: "result", errors}));
          return retResult;
        });
      }
      return ctx.error("invalid_type", "Value is not a function");`
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
      `${expected}.includes(value) ? ctx.result(value) : ctx.error("invalid_type", "Value does not belong to enumeration")`
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
