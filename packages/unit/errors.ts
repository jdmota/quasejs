import concordance from "concordance";
import { coloredConcordanceOptions } from "./concordance-options";

export type ErrorOpts = Readonly<{
  error: unknown;
  stack: string;
  user: boolean;
  uncaught?: boolean;
  overrideStack?: boolean;
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
    if ("diff" in error && typeof error.diff === "string") {
      diff = error.diff;
    } else if ("actual" in error && "expected" in error) {
      diff = concordance.diff(
        error.actual,
        error.expected,
        coloredConcordanceOptions
      );
    }
    const err = error as Record<string, unknown>;
    return {
      name: (err.name ?? "Error") + "",
      message: (err.message ?? "") + "",
      stack: opts.overrideStack ? stack : (err.stack ?? stack) + "",
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
