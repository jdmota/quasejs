import concordance from "concordance";
import { concordanceOptions } from "./concordance-options";

export type ErrorOpts = Readonly<{
  error: unknown;
  stack: string;
  user: boolean;
  uncaught?: boolean;
}>;

export type SimpleError = Readonly<{
  name: string;
  message: string;
  stack: string;
  diff?: string;
  user: boolean;
  uncaught: boolean;
}>;

export function processError(opts: ErrorOpts): SimpleError {
  const { error, stack, user, uncaught } = opts;
  if (error != null && typeof error === "object") {
    let diff = undefined;
    if ("actual" in error && "expected" in error) {
      diff = concordance.diff(error.actual, error.expected, concordanceOptions);
    }
    const err = error as Record<string, unknown>;
    return {
      name: (err.name ?? "Error") + "",
      message: (err.message ?? "") + "",
      stack: (err.stack ?? stack) + "",
      diff,
      user,
      uncaught: uncaught ?? false,
    };
  }
  if (typeof error === "string") {
    return {
      name: "Error",
      message: error,
      stack,
      user,
      uncaught: uncaught ?? false,
    };
  }
  return {
    name: "UnknownError",
    message: error + "",
    stack,
    user,
    uncaught: uncaught ?? false,
  };
}
