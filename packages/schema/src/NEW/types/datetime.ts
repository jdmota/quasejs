import { DateTime } from "luxon";
import { SchemaOpCtx } from "../util/context";
import { Result } from "../util/result";
import { PickSchemaType } from "../schema";

export class DateTimeType
  implements PickSchemaType<"validate" | "decodeJS", DateTime>
{
  readonly format: string;

  constructor(format: string) {
    this.format = format;
  }

  validate(value: DateTime, ctx: SchemaOpCtx): void {
    if (!value.isValid) {
      ctx.pushError(
        value,
        `Expected a valid date-time but got ${value} (${value.invalidReason}: ${value.invalidExplanation})`
      );
    }
  }

  decodeJS(value: unknown, ctx: SchemaOpCtx): Result<DateTime> {
    if (typeof value === "string") {
      try {
        const datetime = DateTime.fromFormat(value, this.format);
        if (datetime.invalidReason === "unparsable") {
          throw new Error(datetime.invalidExplanation!);
        }
        return Result.ok(datetime);
      } catch (err: any) {
        return ctx.resultError(
          value,
          `Error parsing date-time with format ${this.format} (${err.message})`
        );
      }
    }
    return ctx.resultError(
      value,
      `Expected a date-time string with format ${
        this.format
      } but got ${ctx.format(value)}`
    );
  }
}
