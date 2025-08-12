import { string } from "./js-types";

type StringTypeOpts = Partial<{
  readonly nonEmpty: boolean;
  readonly regex: RegExp;
}>;

export function stringType(opts: StringTypeOpts = {}) {
  return string.refineMore((value, ctx) => {
    const { nonEmpty, regex } = opts;
    if (nonEmpty && value.length === 0) {
      ctx.addError("Expected non-empty string");
    }
    if (regex && !regex.test(value)) {
      ctx.addError(`Expected string matching ${regex}`);
    }
  });
}
