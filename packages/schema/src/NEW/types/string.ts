import { createSchemaType } from "../schema";
import { SchemaOpCtx } from "../util/context";

type StringTypeOpts = Partial<{
  readonly nonEmpty: boolean;
  readonly regex: RegExp;
}>;

export function stringType(opts: StringTypeOpts = {}) {
  return createSchemaType<unknown, string>(
    (value: unknown, ctx: SchemaOpCtx) => {
      if (typeof value === "string") {
        const { nonEmpty, regex } = opts;
        if (nonEmpty && value.length === 0) {
          ctx.addError("Expected non-empty string");
        }
        if (regex && !regex.test(value)) {
          ctx.addError(`Expected string matching ${regex}`);
        }
        return ctx.result(value);
      }
      return ctx.validate(false, "a string", value);
    }
  );
}

export const stringTypeSingleton = stringType();
