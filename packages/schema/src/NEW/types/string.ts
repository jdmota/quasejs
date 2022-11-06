import { SchemaType } from "../schema";
import { SchemaOpCtx } from "../util/context";
import { Result } from "../util/result";

type StringTypeOpts = Partial<{
  readonly nonEmpty: boolean;
  readonly regex: RegExp;
}>;

export class StringType
  implements
    Pick<
      SchemaType<string, unknown, unknown, unknown>,
      "validate" | "decodeJS"
    >
{
  readonly opts: StringTypeOpts;
  constructor(opts: StringTypeOpts) {
    this.opts = opts;
  }

  validate(value: string, ctx: SchemaOpCtx): void {
    const { nonEmpty, regex } = this.opts;
    if (nonEmpty) {
      if (value.length === 0) {
        ctx.pushError(value, "Expected non-empty string");
      }
    }
    if (regex) {
      if (!regex.test(value)) {
        ctx.pushError(value, `Expected string matching ${regex}`);
      }
    }
  }

  decodeJS(value: unknown, ctx: SchemaOpCtx): Result<string> {
    return ctx.directDecode(typeof value === "string", "a string", value);
  }
}
