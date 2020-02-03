const turbocolor = require("turbocolor");

export function isObject(x: unknown): x is object {
  return x != null && typeof x === "object";
}

export function arrify<T>(val: null | T | T[]): T[] {
  if (val == null) {
    return [];
  }
  return Array.isArray(val) ? val : [val];
}

export function pad(str: string, length: number) {
  while (str.length < length) {
    str += " ";
  }
  return str;
}

export function printError(error: Error) {
  let message;
  // @ts-ignore
  if (error.__validation) {
    message = `${turbocolor.bold(
      "Validation Error"
    )}:\n\n${error.message.replace(/^(?!$)/gm, "  ")}`;
  } else {
    message = error.stack;
  }
  console.error(`${turbocolor.red(message)}\n`); // eslint-disable-line no-console
}
