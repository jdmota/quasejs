import { formatKey } from "../util/format";
import { SchemaOpCtx } from "../util/context";
import { Result } from "../util/result";
import { GetSchemaTS, SchemaType } from "../schema";

export type ObjectFields = {
  readonly [field: string]: Pick<
    SchemaType<unknown, unknown, unknown, unknown>,
    "validate" | "decodeJS"
  >;
};

export type ObjectValue<F extends ObjectFields> = {
  readonly [key in keyof F]: GetSchemaTS<F[key]>;
};

const hasOwn = Object.prototype.hasOwnProperty;
const hasProp = (o: any, k: string) => hasOwn.call(o, k);
const getProp = (o: any, k: string) => (hasProp(o, k) ? o[k] : undefined);

export class ObjectType<F extends ObjectFields>
  implements
    Pick<
      SchemaType<ObjectValue<F>, unknown, unknown, unknown>,
      "validate" | "decodeJS"
    >
{
  private readonly fields: F;
  private readonly entries: readonly [
    string,
    Pick<
      SchemaType<unknown, unknown, unknown, unknown>,
      "validate" | "decodeJS"
    >
  ][];

  constructor(fields: F) {
    this.fields = fields;
    this.entries = Object.entries(this.fields);
  }

  validate(object: ObjectValue<F>, ctx: SchemaOpCtx): void {
    for (const [key, field] of this.entries) {
      ctx.push(key);
      field.validate(getProp(object, key), ctx);
      ctx.pop();
    }
  }

  decodeJS(object: unknown, ctx: SchemaOpCtx): Result<ObjectValue<F>> {
    if (typeof object === "object" && object != null) {
      const newEntries = [];
      const extraneousKeys = new Set(Object.keys(object));
      for (const [key, field] of this.entries) {
        ctx.push(key);
        const decoded = field.decodeJS(getProp(object, key), ctx);
        if (decoded.ok) {
          newEntries.push([key, decoded.value] as const);
        } else {
          return decoded;
        }
        ctx.pop();
        extraneousKeys.delete(key);
      }
      if (extraneousKeys.size > 0) {
        return Result.error(
          ctx.error(
            object,
            `Extraneous properties: ${Array.from(extraneousKeys)
              .map(k => formatKey(k))
              .join(", ")}`
          )
        );
      }
      return Result.ok(Object.fromEntries(newEntries) as ObjectValue<F>);
    }
    return ctx.directDecode(false, "an object", object);
  }
}
