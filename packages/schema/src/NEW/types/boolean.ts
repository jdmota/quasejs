import { SchemaType } from "../schema";
import { SchemaOpCtx } from "../util/context";
import { Result } from "../util/result";

export class BooleanType
  implements
    Pick<
      SchemaType<boolean, unknown, unknown, unknown>,
      "validate" | "decodeJS"
    >
{
  validate(value: boolean, ctx: SchemaOpCtx): void {}

  decodeJS(value: unknown, ctx: SchemaOpCtx): Result<boolean> {
    return ctx.directDecode(typeof value === "boolean", "a boolean", value);
  }
}
