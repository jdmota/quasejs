import { getStack } from "@quase/error";

export default class SkipError extends Error {
  constructor(message: string | undefined) {
    super(message);
    this.name = "SkipError";
    this.message = message || "No reason";
    this.stack = getStack();
  }
}
