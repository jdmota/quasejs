import {
  codeFrameColumns,
  type BabelCodeFrameOptions,
} from "@babel/code-frame";
import type { Optional } from "../util/miscellaneous";
import type { ReadonlyDeep } from "type-fest";
import * as colorette from "colorette";
import { emoji } from "../util/terminal";
import { prettify } from "../util/path-url";
import { beautifySimple, positionToString } from "./errors";

export type DiagnosticLoc = Readonly<{
  filePath: string | null;
  end: DiagnosticPosition | null;
  start: DiagnosticPosition;
}>;

export type DiagnosticPosition = Readonly<{
  column: number | null;
  line: number;
}>;

export type BasicDiagnostic = ReadonlyDeep<{
  category: "info" | "warn" | "error";
  message: string;
  loc?: Optional<DiagnosticLoc>;
  stack?: Optional<string>;
  codeFrame?: Optional<string>;
}>;

export type DiagnosticOpts = BasicDiagnostic &
  ReadonlyDeep<{
    related?: readonly Diagnostic[];
  }>;

export type SerializedDiagnostic = BasicDiagnostic &
  ReadonlyDeep<{
    related?: readonly SerializedDiagnostic[];
  }>;

export class Diagnostic {
  readonly category: "info" | "warn" | "error";
  readonly message: string;
  readonly loc: Optional<DiagnosticLoc>;
  readonly stack: Optional<string>;
  readonly codeFrame: Optional<string>;
  readonly related: readonly Diagnostic[];

  constructor({
    category,
    message,
    loc,
    stack,
    codeFrame,
    related,
  }: DiagnosticOpts) {
    this.category = category;
    this.message = message;
    this.loc = loc;
    this.stack = stack;
    this.codeFrame = codeFrame;
    this.related = related || [];
  }

  attachStack(func: Function) {
    if (!this.stack) {
      Error.captureStackTrace(this, func);
    }
  }
}

function indentStr(str: string, indent: string) {
  return str.replace(/^(?!\s*$)/gm, indent);
}

const formatMessage = {
  error: (message: string) =>
    `${emoji.error}  ${colorette.red(colorette.bold(message))}`,
  warn: (message: string) =>
    `${emoji.warning}  ${colorette.yellow(colorette.bold(message))}`,
  info: (message: string) =>
    `${emoji.info}  ${colorette.blue(colorette.bold(message))}`,
};

function formatDiagnosticHelper(
  diagnostic: Diagnostic,
  indent: string,
  lines: string[]
) {
  const { category, message, loc, stack, codeFrame, related } = diagnostic;

  lines.push(`${indent}${formatMessage[category](message)}`);

  if (loc) {
    lines.push(`${indent}${colorette.gray(locToString(loc))}`);
  }

  if (codeFrame) {
    lines.push(indentStr(codeFrame, indent));
  }

  if (stack) {
    lines.push(indentStr(colorette.gray(beautifySimple(stack).stack), indent));
  }

  if (related.length) {
    lines.push(`${indent}${colorette.bold("Related:")}`);

    for (const d of related) {
      formatDiagnosticHelper(d, indent + "  ", lines);
    }
  }
}

export function formatDiagnostic(diagnostic: Diagnostic) {
  const lines: string[] = [];
  formatDiagnosticHelper(diagnostic, "", lines);
  return lines.join("\n");
}

export function throwDiagnostic(diagnostic: DiagnosticOpts): never {
  throw new Diagnostic(diagnostic);
}

export function createDiagnostic(diagnostic: DiagnosticOpts): Diagnostic {
  return new Diagnostic(diagnostic);
}

export function createDiagnosticFromError(
  error: Error,
  category: Diagnostic["category"] = "error"
) {
  return createDiagnostic({
    category,
    message: `${error.name}: ${error.message}`,
    stack: error.stack
      ? error.stack.slice(error.stack.indexOf("\n") + 1)
      : undefined,
  });
}

export function createDiagnosticFromAny(
  value: unknown,
  category: Diagnostic["category"] = "error"
) {
  if (isDiagnostic(value)) {
    return value;
  }
  if (value instanceof Error) {
    return createDiagnosticFromError(value, category);
  }
  return createDiagnostic({
    category,
    message: value + "",
  });
}

export function isDiagnostic(value: unknown): value is Diagnostic {
  return value instanceof Diagnostic;
}

export function serializeDiagnostic(value: Diagnostic): SerializedDiagnostic {
  return {
    ...value,
    related: value.related && value.related.map(serializeDiagnostic),
  };
}

export function deserializeDiagnostic(value: SerializedDiagnostic): Diagnostic {
  return createDiagnostic({
    ...value,
    related: value.related && value.related.map(deserializeDiagnostic),
  });
}

export function createCodeFrame({
  code,
  loc,
  options,
}: {
  code: string;
  loc: DiagnosticLoc;
  options?: BabelCodeFrameOptions;
}) {
  return codeFrameColumns(
    code,
    {
      start: {
        line: loc.start.line,
        column: loc.start.column ?? undefined,
      },
      end: loc.end
        ? {
            line: loc.end.line,
            column: loc.end.column ?? undefined,
          }
        : undefined,
    },
    options
  );
}

function locToString(loc: Optional<DiagnosticLoc>) {
  if (loc) {
    const start = `${prettify(
      loc.filePath || "Unknown file"
    )}:${positionToString(loc.start)}`;
    if (loc.end == null) {
      return start;
    }
    return `${start}-${positionToString(loc.end)}`;
  }
  return "";
}
