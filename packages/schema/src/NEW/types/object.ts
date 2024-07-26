import { formatKey } from "../util/format";
import { SchemaOpCtx } from "../util/context";
import { GetSchemaOutput, SchemaTypeSync, createSchemaType } from "../schema";

export type ObjectFields = {
  readonly [field: string]: SchemaTypeSync<unknown, unknown>;
};

export type ObjectValue<F extends ObjectFields> = {
  readonly [key in keyof F]: GetSchemaOutput<F[key]>;
};

const hasOwn = Object.prototype.hasOwnProperty;
const hasProp = (o: any, k: string) => hasOwn.call(o, k);
const getProp = (o: any, k: string) => (hasProp(o, k) ? o[k] : undefined);

const PROTO_KEY = "__proto__";

export function objectType<F extends ObjectFields>(fields: F, exact = true) {
  const entries = Object.entries(fields);
  if (hasProp(fields, PROTO_KEY)) {
    throw new Error("Object schema includes __proto__ key");
  }
  return createSchemaType<unknown, ObjectValue<F>>(
    (object: unknown, ctx: SchemaOpCtx) => {
      if (typeof object === "object" && object != null) {
        const newEntries = [];
        const extraneousKeys = new Set(Object.keys(object));
        if (extraneousKeys.has(PROTO_KEY)) {
          ctx.addError("Object has own property __proto__");
        }
        for (const [key, field] of entries) {
          ctx.push(key);
          const decoded = field.parse(getProp(object, key), ctx);
          if (decoded.ok) {
            newEntries.push([key, decoded.value] as const);
          } else {
            return decoded;
          }
          ctx.pop();
          extraneousKeys.delete(key);
        }
        if (exact && extraneousKeys.size > 0) {
          return ctx.error(
            `Extraneous properties: ${Array.from(extraneousKeys)
              .map(k => formatKey(k))
              .join(", ")}`
          );
        }
        return ctx.result(Object.fromEntries(newEntries) as ObjectValue<F>);
      }
      return ctx.validate(false, "an object", object);
    }
  );
}
