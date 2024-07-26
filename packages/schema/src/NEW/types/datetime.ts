import { DateTime } from "luxon";
import { SchemaOpCtx } from "../util/context";
import { createSchemaType } from "../schema";

export function dateTimeType(format: string) {
  return createSchemaType<unknown, DateTime>(
    (value: unknown, ctx: SchemaOpCtx) => {
      if (typeof value === "string") {
        try {
          const datetime = DateTime.fromFormat(value, format);
          if (datetime.invalidReason === "unparsable") {
            throw new Error(datetime.invalidExplanation!);
          }
          value = datetime;
        } catch (err: any) {
          return ctx.error(
            `Error parsing date-time with format ${format} (${err.message})`
          );
        }
      }
      if (value instanceof DateTime) {
        if (value.isValid) {
          return ctx.result(value);
        }
        return ctx.error(
          `Expected a valid date-time but got ${value} (${value.invalidReason}: ${value.invalidExplanation})`
        );
      }
      return ctx.error(
        `Expected a date-time string with format ${
          format
        } but got ${ctx.format(value)}`
      );
    }
  );
}
