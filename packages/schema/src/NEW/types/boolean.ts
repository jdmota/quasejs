import { PickSchemaType } from "../schema";
import { SchemaOpCtx } from "../util/context";
import { Result } from "../util/result";

export class BooleanType
  implements PickSchemaType<"validate" | "decodeJS", boolean>
{
  validate(value: boolean, ctx: SchemaOpCtx): void {}

  decodeJS(value: unknown, ctx: SchemaOpCtx): Result<boolean> {
    return ctx.directDecode(typeof value === "boolean", "a boolean", value);
  }
}
