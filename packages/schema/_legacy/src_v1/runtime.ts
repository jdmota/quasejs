import is from "@sindresorhus/is";
import leven from "leven";
import { bold, green, yellow, red } from "colorette";
import util from "util";

const reIndent = /^(?!\s*$)/gm;

function indent(str: string, str2: string = "  ") {
  return str.replace(reIndent, str2);
}

function formatOption(option: string): string {
  return bold(util.inspect(option));
}

function format(value: unknown) {
  return util.inspect(value, {
    compact: true,
    depth: 2,
    maxArrayLength: 5,
    breakLength: 50,
  });
}

function printWarning(str: string) {
  console.warn(`${yellow(str)}\n`); // eslint-disable-line no-console
}

function printError(error: Error) {
  let message;
  if (error instanceof ValidationError) {
    message = `${bold("Validation Error")}:\n\n${error.message.replace(
      /^(?!$)/gm,
      "  "
    )}`;
  } else {
    message = error.stack || error.message;
  }
  console.error(`${red(message)}\n`); // eslint-disable-line no-console
}

class Path {
  prev: Path | null;
  key: string;
  size: number;
  where: string | undefined;

  constructor(prev: Path | null, key: string, where?: string) {
    this.prev = prev;
    this.key = key;
    this.size = prev ? prev.size + 1 : 0;
    this.where = where;
  }

  add(key: string) {
    return new Path(this, key, this.where);
  }

  addIdx(key: number) {
    return new Path(this, key + "", this.where);
  }

  format() {
    return formatOption(
      `${this.toString()}${this.where ? ` [in ${this.where}]` : ""}`
    );
  }

  _example(string: string): string {
    const indentation = "  ".repeat(this.size);
    const text = [
      this.prev ? `${indentation}${formatOption(this.key)}: {` : `{`,
      string,
      `${indentation}}`,
    ].join("\n");
    return this.prev == null ? text : this.prev._example(text);
  }

  example(example: unknown) {
    if (this.prev == null) {
      return `{}`;
    }
    return this.prev._example(
      indent(
        `${formatOption(this.key)}: ${bold(format(example))}`,
        "  ".repeat(this.size)
      )
    );
  }

  toString(): string {
    if (this.prev) {
      const prevStr = this.prev.toString();
      return prevStr ? `${prevStr}.${this.key}` : this.key;
    }
    return this.key;
  }
}

class ValidationError extends Error {
  __validation: boolean;
  constructor(message: string | string[]) {
    super(Array.isArray(message) ? message.join("\n") : message);
    this.name = "ValidationError";
    this.__validation = true;
  }
}

function getSuggestion(
  unrecognized: string,
  allowedOptions: string[]
): string | undefined {
  return allowedOptions.find(option => {
    return (leven(option, unrecognized) as number) < 3;
  });
}

function createDidYouMeanMessage(
  unrecognized: string,
  allowedOptions: string[]
) {
  const suggestion = getSuggestion(unrecognized, allowedOptions);
  return suggestion ? `Did you mean ${formatOption(suggestion)}?` : "";
}

function printDeprecated(path: Path, message?: string) {
  printWarning(
    `${bold("Deprecation Warning")}: ${path.format()} ${message || ""}`.trim()
  );
}

function checkUnrecognized(
  path: Path,
  keys: string[],
  allowedOptions: string[],
  what?: string
) {
  const unrecognizedOptions = keys.filter(k => !allowedOptions.includes(k));

  if (unrecognizedOptions.length === 0) {
    return;
  }

  what = what || "option";
  let message;

  const pathStr = path.toString();
  const inStr = pathStr ? ` in ${pathStr}` : "";

  if (unrecognizedOptions.length === 1) {
    const unrecognized = unrecognizedOptions[0];
    const didYouMeanMessage = createDidYouMeanMessage(
      unrecognized,
      allowedOptions
    );
    message = `Unrecognized ${what}${inStr} ${formatOption(
      unrecognized
    )}. ${didYouMeanMessage}`.trimRight();
  } else {
    message = `Following ${what}s were not recognized${inStr}:\n  ${unrecognizedOptions
      .map(formatOption)
      .join(", ")}`;
  }

  throw new ValidationError(message);
}

function makeExample(path: Path, meta: Meta) {
  const lines = [];
  const example = meta == null ? undefined : meta.example;
  if (example !== undefined) {
    lines.push(`Example:`);
    lines.push(path.example(example));
  }
  return lines.join("\n");
}

type Meta = { [key: string]: unknown } | undefined | null;

function assertType(
  path: Path,
  value: unknown,
  expectedType: string,
  meta?: Meta
) {
  const actualType = is(value);

  if (actualType === expectedType) {
    return;
  }

  throw new ValidationError([
    `Option ${path.format()} must be of type:`,
    `${indent(bold(green(expectedType)))}`,
    `but instead received:`,
    `${indent(bold(red(actualType)))}`,
    makeExample(path, meta),
  ]);
}

function assertValue(path: Path, value: unknown, expectedValue: unknown) {
  if (value === expectedValue) {
    return;
  }
  throw new ValidationError([
    `Option ${path.format()} should be:`,
    `${indent(format(expectedValue))}`,
    `but instead received:`,
    `${indent(bold(red(format(value))))}`,
  ]);
}

function assertSize(
  path: Path,
  size: number,
  expectedSize: number,
  meta?: Meta
) {
  if (size > expectedSize) {
    throw new ValidationError([
      `Option ${path.format()} must be an array of ${expectedSize} items.`,
      makeExample(path, meta),
    ]);
  }
}

function requiredError(path: Path) {
  return new ValidationError(`Option ${path.format()} is required.`);
}

class Busy {
  set: WeakSet<object>;

  constructor() {
    this.set = new WeakSet();
  }

  add(path: Path, value: unknown) {
    if (typeof value === "object" && value != null) {
      if (this.set.has(value)) {
        throw new ValidationError(
          `Same reference in multiple places or circular references are not allowed (in ${path.format()})`
        );
      }
      this.set.add(value);
    }
  }

  remove(value: unknown) {
    if (typeof value === "object" && value != null) {
      this.set.delete(value);
    }
  }
}

export default {
  Path,
  Busy,
  printDeprecated,
  printWarning,
  printError,
  checkUnrecognized,
  assertType,
  assertValue,
  assertSize,
  requiredError,
  ValidationError,
};
