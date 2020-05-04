import { printError } from "./utils";
import util from "util";

// Adapted from https://github.com/sindresorhus/hard-rejection

let installed = false;

export default function () {
  if (installed) {
    return;
  }
  installed = true;

  process.on("unhandledRejection", error => {
    if (error instanceof Error) {
      printError(error);
    } else {
      printError(
        new Error(`Promise rejected with value: ${util.inspect(error)}`)
      );
    }
    process.exit(1);
  });
}
