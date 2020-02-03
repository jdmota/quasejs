import turbocolor from "turbocolor";

export function setExitCode(code: number) {
  if (!process.exitCode) {
    process.exitCode = code;
  }
}

export function validationError(message: string) {
  const err: any = new Error(message);
  err.__validation = true;
  return err;
}

export function printError(error: Error) {
  let message;
  // @ts-ignore
  if (error.__validation || !error.stack) {
    message = `${turbocolor.bold(
      "Validation Error"
    )}:\n\n${error.message.replace(/^(?!$)/gm, "  ")}`;
  } else {
    message = error.stack;
  }
  console.error(`${turbocolor.red(message)}\n`); // eslint-disable-line no-console
}
