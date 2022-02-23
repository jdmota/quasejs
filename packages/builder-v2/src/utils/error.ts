import { codeFrameColumns, BabelCodeFrameOptions } from "@babel/code-frame";
import colorette from "colorette";
import { prettify } from "@quase/path-url";
import { Loc, Position, Optional, DeepReadonly } from "../types";
import emoji from "./emoji";
import { ifNullUndef } from ".";

type BasicDiagnostic = DeepReadonly<{
  category: "info" | "warn" | "error";
  message: string;
  loc?: Optional<Loc>;
  stack?: Optional<string>;
  codeFrame?: Optional<string>;
}>;

export type DiagnosticOpts = BasicDiagnostic &
  DeepReadonly<{
    related?: readonly Diagnostic[];
  }>;

export type SerializedDiagnostic = BasicDiagnostic &
  DeepReadonly<{
    related?: readonly SerializedDiagnostic[];
  }>;

export class Diagnostic {
  readonly category: "info" | "warn" | "error";
  readonly message: string;
  readonly loc: Optional<Loc>;
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
    lines.push(indentStr(colorette.gray(stack), indent));
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
  x: Error,
  category: Diagnostic["category"] = "error"
) {
  return createDiagnostic({
    category,
    message: `${x.name}: ${x.message}`,
    stack: x.stack ? x.stack.slice(x.stack.indexOf("\n") + 1) : undefined,
  });
}

export function createDiagnosticFromAny(
  x: unknown,
  category: Diagnostic["category"] = "error"
) {
  if (isDiagnostic(x)) {
    return x;
  }
  if (x instanceof Error) {
    return createDiagnosticFromError(x, category);
  }
  return createDiagnostic({
    category,
    message: x + "",
  });
}

export function isDiagnostic(x: unknown): x is Diagnostic {
  return x instanceof Diagnostic;
}

export function serializeDiagnostic(x: Diagnostic): SerializedDiagnostic {
  return {
    ...x,
    related: x.related && x.related.map(serializeDiagnostic),
  };
}

export function deserializeDiagnostic(x: SerializedDiagnostic): Diagnostic {
  return createDiagnostic({
    ...x,
    related: x.related && x.related.map(deserializeDiagnostic),
  });
}

export function createCodeFrame({
  code,
  loc,
  options,
}: {
  code: string;
  loc: Loc;
  options?: BabelCodeFrameOptions;
}) {
  return codeFrameColumns(
    code,
    {
      start: {
        line: loc.start.line,
        column: ifNullUndef(loc.start.column),
      },
      end: loc.end
        ? {
            line: loc.end.line,
            column: ifNullUndef(loc.end.column),
          }
        : undefined,
    },
    options
  );
}

export function positionToString(pos: Optional<Position>) {
  if (pos) {
    if (pos.column == null) {
      return `${pos.line}`;
    }
    return `${pos.line}:${pos.column}`;
  }
  return "";
}

export function locToString(loc: Optional<Loc>) {
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
