const parseCircular = (fn, value, ctx) => {
  if (ctx.pushValue(value)) {
    const r = fn(value, ctx);
    ctx.popValue(value);
    return r;
  }
  return ctx.error("circular", "Circular reference disallowed");
};
const hasOwn = Object.prototype.hasOwnProperty;
const hasProp = (o, k) => hasOwn.call(o, k);
const checkForbiddenKeys = (obj, ctx) => {
  if (hasProp(obj, "__proto__")) {
    ctx.addError("forbidden_key", "Object has own property __proto__");
    if (ctx.shouldAbort()) return;
  }
  if (hasProp(obj, "constructor")) {
    ctx.addError("forbidden_key", "Object has own property constructor");
    if (ctx.shouldAbort()) return;
  }
  if (hasProp(obj, "prototype")) {
    ctx.addError("forbidden_key", "Object has own property prototype");
    if (ctx.shouldAbort()) return;
  }
};
const getProp = (o, k) => (hasProp(o, k) ? o[k] : undefined);
const catchUnknownKeys = (object, ctx, newEntries, extraneousKeys, keyParse, valueParse, partial) => {
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
};
const formatKey = key => JSON.stringify(key);
const reportExtraneousKeys = (ctx, extraneousKeys) => {
  return ctx.error(
    "extraneous_keys",
    `Extraneous keys: ${Array.from(extraneousKeys)
      .map(k => formatKey(k))
      .join(", ")}`
  );
};
const parse_object = (value, ctx) => {
  return parseCircular(parse_helper_object, value, ctx);
};
const parse_helper_object = (value, ctx) => {
  const object = value;
  if (typeof object === "object" && object != null) {
    const newEntries = []; let value, decoded;
    checkForbiddenKeys(object, ctx);
    if (ctx.shouldAbort()) return ctx.none;
    const extraneousKeys = new Set(Reflect.ownKeys(object));
    ctx.push();
    value = getProp(object, "a");
    decoded = parse_null(value, ctx);
    if (decoded.some) {
      newEntries.push(["a", decoded.value]);
    }
    ctx.popKey("a");
    if (ctx.shouldAbort()) return ctx.none;
    extraneousKeys.delete("a");
    ctx.push();
    value = getProp(object, "b");
    decoded = parse_number(value, ctx);
    if (decoded.some) {
      newEntries.push(["b", decoded.value]);
    }
    ctx.popKey("b");
    if (ctx.shouldAbort()) return ctx.none;
    extraneousKeys.delete("b");
    ctx.push();
    value = getProp(object, "c");
    decoded = parse_array(value, ctx);
    if (decoded.some) {
      newEntries.push(["c", decoded.value]);
    }
    ctx.popKey("c");
    if (ctx.shouldAbort()) return ctx.none;
    extraneousKeys.delete("c");
    ctx.push();
    value = getProp(object, "d");
    decoded = parse_object0(value, ctx);
    if (decoded.some) {
      newEntries.push(["d", decoded.value]);
    }
    ctx.popKey("d");
    if (ctx.shouldAbort()) return ctx.none;
    extraneousKeys.delete("d");
    ctx.push();
    value = getProp(object, "e");
    decoded = parse_tuple(value, ctx);
    if (decoded.some) {
      newEntries.push(["e", decoded.value]);
    }
    ctx.popKey("e");
    if (ctx.shouldAbort()) return ctx.none;
    extraneousKeys.delete("e");
    ctx.push();
    value = getProp(object, "f");
    decoded = parse_record(value, ctx);
    if (decoded.some) {
      newEntries.push(["f", decoded.value]);
    }
    ctx.popKey("f");
    if (ctx.shouldAbort()) return ctx.none;
    extraneousKeys.delete("f");
    ctx.push();
    value = getProp(object, "g");
    decoded = parse_function(value, ctx);
    if (decoded.some) {
      newEntries.push(["g", decoded.value]);
    }
    ctx.popKey("g");
    if (ctx.shouldAbort()) return ctx.none;
    extraneousKeys.delete("g");
    if (extraneousKeys.size > 0) {
      return reportExtraneousKeys(ctx, extraneousKeys);
    }
    return ctx.result(Object.fromEntries(newEntries));
  }
  return ctx.error("invalid_type", "Value is not an object");
};
const parse_null = (value, ctx) => {
  return value === null ? ctx.result(value) : ctx.error("invalid_type", "Value is not null");
};
const parse_number = (value, ctx) => {
  return typeof value === "number" ? ctx.result(value) : ctx.error("invalid_type", "Value is not a number");
};
const parse_array = (value, ctx) => {
  return parseCircular(parse_helper_array, value, ctx);
};
const parse_helper_array = (value, ctx) => {
  if (Array.isArray(value)) {
    const newArray = [];
    for (let i = 0; i < value.length; i++) {
      ctx.push();
      const result = parse_string(value[i], ctx);
      if (result.some) newArray.push(result.value);
      ctx.popIdx(i);
      if (ctx.shouldAbort()) return ctx.none;
    }
    return ctx.result(newArray);
  }
  return ctx.error("invalid_type", "Value is not an array");
};
const parse_string = (value, ctx) => {
  return typeof value === "string" ? ctx.result(value) : ctx.error("invalid_type", "Value is not a string");
};
const parse_object0 = (value, ctx) => {
  return parseCircular(parse_helper_object0, value, ctx);
};
const parse_helper_object0 = (value, ctx) => {
  const object = value;
  if (typeof object === "object" && object != null) {
    const newEntries = []; let value, decoded;
    checkForbiddenKeys(object, ctx);
    if (ctx.shouldAbort()) return ctx.none;
    const extraneousKeys = new Set(Reflect.ownKeys(object));
    catchUnknownKeys(object, ctx, newEntries, extraneousKeys, parse_string, parse_bigint, false);
    return ctx.result(Object.fromEntries(newEntries));
  }
  return ctx.error("invalid_type", "Value is not an object");
};
const parse_bigint = (value, ctx) => {
  return typeof value === "bigint" ? ctx.result(value) : ctx.error("invalid_type", "Value is not a bigint");
};
const parse_tuple = (value, ctx) => {
  return parseCircular(parse_helper_tuple, value, ctx);
};
const parse_helper_tuple = (value, ctx) => {
  if (
    Array.isArray(value) &&
    3 <= value.length
  ) {
    const newTuple = []; let result;
    ctx.push();
    result = parse_bigint(value[0], ctx);
    if (result.some) newTuple.push(result.value);
    ctx.popIdx(0);
    if (ctx.shouldAbort()) return ctx.none;
    ctx.push();
    result = parse_boolean(value[1], ctx);
    if (result.some) newTuple.push(result.value);
    ctx.popIdx(1);
    if (ctx.shouldAbort()) return ctx.none;
    ctx.push();
    result = parse_null(value[2], ctx);
    if (result.some) newTuple.push(result.value);
    ctx.popIdx(2);
    if (ctx.shouldAbort()) return ctx.none;
    for (let i = 3; i < value.length; i++) {
      ctx.push();
      const result = parse_literal(value[i], ctx);
      if (result.some) newTuple.push(result.value);
      ctx.popIdx(i);
      if (ctx.shouldAbort()) return ctx.none;
    }
    return ctx.result(newTuple);
  }
  return ctx.error("invalid_type", "Value is not a tuple of at least size " + 3);
};
const parse_boolean = (value, ctx) => {
  return typeof value === "boolean" ? ctx.result(value) : ctx.error("invalid_type", "Value is not a boolean");
};
const expected_literal = "abc";

const parse_literal = (value, ctx) => {
  return value === expected_literal ? ctx.result(expected_literal) : ctx.error("invalid_type", "Invalid literal");
};
const parse_record = (value, ctx) => {
  return parseCircular(parse_helper_record, value, ctx);
};
const parse_helper_record = (value, ctx) => {
  const object = value;
  if (typeof object === "object" && object != null) {
    checkForbiddenKeys(object, ctx);
    if (ctx.shouldAbort()) return ctx.none;
    const newEntries = [];
    for (const key of Reflect.ownKeys(object)) {
      ctx.push();
      const keyResult = parse_number(key, ctx);
      ctx.popCtx(errors => ({code: "invalid_key", key, errors}));
      if (ctx.shouldAbort()) return ctx.none;
      ctx.push();
      const valueResult = parse_string(object[key], ctx);
      ctx.popKey(key);
      if (ctx.shouldAbort()) return ctx.none;
      if (keyResult.some && valueResult.some) {
        newEntries.push([keyResult.value, valueResult.value]);
      }
    }
    return ctx.result(Object.fromEntries(newEntries));
  }
  return ctx.error("invalid_type", "Value is not an object");
};
const parse_function = (value, ctx) => {
  if (typeof value === "function") {
    const lockCtx = SchemaOpCtx.new(ctx);
    return ctx.result(function (...args) {
      const newCtx = SchemaOpCtx.new(lockCtx);
      if (newCtx.shouldAbort()) return newCtx.validationResult(newCtx.none);
      newCtx.push();
      const argsResult = parse_tuple0(args, newCtx);
      newCtx.popCtx(errors => ({code: "function_error", where: "arguments", errors}));
      if (!argsResult.some) return newCtx.validationResult(argsResult);
      const ret = Reflect.apply(value, this, argsResult.value);
      newCtx.push();
      const retResult = parse_boolean(ret, newCtx);
      newCtx.popCtx(errors => ({code: "function_error", where: "result", errors}));
      return newCtx.validationResult(retResult);
    });
  }
  return ctx.error("invalid_type", "Value is not a function");
};
const parse_tuple0 = (value, ctx) => {
  return parseCircular(parse_helper_tuple0, value, ctx);
};
const parse_helper_tuple0 = (value, ctx) => {
  if (
    Array.isArray(value) &&
    3 === value.length
  ) {
    const newTuple = []; let result;
    ctx.push();
    result = parse_null(value[0], ctx);
    if (result.some) newTuple.push(result.value);
    ctx.popIdx(0);
    if (ctx.shouldAbort()) return ctx.none;
    ctx.push();
    result = parse_undefined(value[1], ctx);
    if (result.some) newTuple.push(result.value);
    ctx.popIdx(1);
    if (ctx.shouldAbort()) return ctx.none;
    ctx.push();
    result = parse_string(value[2], ctx);
    if (result.some) newTuple.push(result.value);
    ctx.popIdx(2);
    if (ctx.shouldAbort()) return ctx.none;
    return ctx.result(newTuple);
  }
  return ctx.error("invalid_type", "Value is not a tuple of size " + 3);
};
const parse_undefined = (value, ctx) => {
  return value === undefined ? ctx.result(value) : ctx.error("invalid_type", "Value is not undefined");
};

export default (value, opts) => {
  const ctx = SchemaOpCtx.new(opts);
  const result = parse_object(value, ctx);
  return ctx.validationResult(result);
};
