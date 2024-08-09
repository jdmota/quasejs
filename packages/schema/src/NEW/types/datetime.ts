import { DateTime } from "luxon";
import { string, union } from "./js-types";

export function dateTime(format: string) {
  return union([string]).transform((_value, ctx, NEVER) => {
    let value: unknown = _value;
    if (typeof value === "string") {
      try {
        const datetime = DateTime.fromFormat(value, format);
        if (datetime.invalidReason === "unparsable") {
          ctx.addError(
            `Error parsing date-time with format ${format} (${datetime.invalidExplanation!})`
          );
          return NEVER;
        }
        value = datetime;
      } catch (err: any) {
        ctx.addError(
          `Error parsing date-time with format ${format} (${err.message})`
        );
        return NEVER;
      }
    }
    if (value instanceof DateTime) {
      if (!value.isValid) {
        ctx.addError(
          `Expected a valid date-time but got ${value} (${value.invalidReason}: ${value.invalidExplanation})`
        );
        return NEVER;
      }
      return value as DateTime<true>;
    }
    ctx.addError(
      `Expected a date-time string with format ${
        format
      } but got ${ctx.format(value)}`
    );
    return NEVER;
  });
}
