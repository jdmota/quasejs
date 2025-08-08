import stackParser from "error-stack-parser";
import { slash, prettify } from "../util/path-url";
import { type SourceMapExtractor } from "../source-map/extractor";
import type { Optional } from "../util/miscellaneous";

export const ignoreStackTraceRe =
  /StackTrace\$\$|ErrorStackParser\$\$|StackTraceGPS\$\$|StackGenerator\$\$/;
export const ignoreFileRe =
  /^([^()\s]*\/quasejs\/packages\/[^()\s/]+\/dist\/[^()\s]*|[^()\s]*\/node_modules\/@quase\/[^()\s]+|[^()\s/]+\.js|node:[^()\s]+|internal(\/[^()\s/]+)?\/[^()\s]+\.js|native)$/;

export type ErrorBeautifyOpts = Readonly<{
  extractor?: SourceMapExtractor;
  ignore?: Optional<{
    test(text: string): boolean;
  }>;
}>;

export type ErrorBeautifySimpleOpts = Readonly<{
  ignore?: Optional<{
    test(text: string): boolean;
  }>;
}>;

type StackFrame = stackParser.StackFrame & { fileName: string };

function excludeFramesWithoutFilename(
  v: stackParser.StackFrame
): v is StackFrame {
  return !!v.fileName;
}

export type BeautifiedStackLine = {
  file: string;
  code: string | null;
  name: string | null;
  line: number | null;
  column: number | null;
  args: readonly any[] | null;
};

export async function beautify(
  originalStack: string,
  options: ErrorBeautifyOpts = {}
) {
  const extractor = options && options.extractor;
  const { originalFirst, cleaned } = cleanErrorFrames(originalStack, options);
  const cleaned2 = await Promise.all(
    cleaned.map(async stackLine => {
      if (extractor && stackLine.line && stackLine.column) {
        try {
          const pos = await extractor.getOriginalLocation(stackLine.file, {
            line: stackLine.line,
            column: stackLine.column,
          });
          if ("line" in pos) {
            if (pos.originalFile != null) {
              stackLine.file = pos.originalFile;
              stackLine.code = pos.originalCode;
              stackLine.name = pos.name || stackLine.name;
              stackLine.line = pos.line;
              stackLine.column = pos.column;
            }
          } else {
            stackLine.code = pos.code;
          }
        } catch (e) {
          // Ignore
        }
      }
      return stackLine;
    })
  );
  return printCleanedErrorFrames(originalStack, {
    originalFirst,
    cleaned: cleaned2,
  });
}

export function beautifySimple(
  originalStack: string,
  options: ErrorBeautifySimpleOpts = {}
) {
  const { originalFirst, cleaned } = cleanErrorFrames(originalStack, options);
  return printCleanedErrorFrames(originalStack, { originalFirst, cleaned });
}

export function cleanErrorFrames(
  originalStack: string,
  options: ErrorBeautifySimpleOpts = {}
) {
  const ignore = options && options.ignore;
  const error = { name: "", message: "", stack: originalStack };

  const originalFrames = stackParser
    .parse(error)
    .filter(excludeFramesWithoutFilename);

  const frames = originalFrames.filter(({ fileName, functionName }) => {
    const file = slash(fileName);
    if (ignore && (ignore.test(fileName) || ignore.test(file))) {
      return false;
    }
    // Electron
    if (
      file.includes(".app/Contents/Resources/electron.asar") ||
      file.includes(".app/Contents/Resources/default_app.asar")
    ) {
      return false;
    }
    return (
      !ignoreFileRe.test(file) && !ignoreStackTraceRe.test(functionName || "")
    );
  });

  const originalFirst: StackFrame | undefined = originalFrames[0];

  if (frames.length === 0 && originalFirst) {
    frames.push(originalFirst);
  }

  return {
    originalFirst,
    cleaned: frames.map(
      ({ fileName, functionName, args, lineNumber, columnNumber }) => {
        const stackLine: BeautifiedStackLine = {
          file: fileName,
          code: null,
          name: functionName ?? null,
          line: lineNumber ?? null,
          column: columnNumber ?? null,
          args: args ?? null,
        };
        return stackLine;
      }
    ),
  };
}

function textLine(stackLine: BeautifiedStackLine) {
  return `${stackLine.name}${
    stackLine.args ? `(${stackLine.args.join(", ")})` : ""
  }`;
}

export function printCleanedErrorFrames(
  originalStack: string,
  { originalFirst, cleaned }: ReturnType<typeof cleanErrorFrames>
) {
  const cleanedText = cleaned.map(
    s => `${textLine(s)} (${prettify(s.file)}:${s.line}:${s.column})`
  );

  const title =
    originalFirst && originalFirst.source
      ? originalStack.split(originalFirst.source).shift()
      : originalStack;

  const lines = cleanedText.map(x => `    ${x}`).join("\n");
  const stack = `${title}${lines}`;

  const first = cleaned[0];

  return {
    stack,
    source: first && first.file ? first : null,
  };
}

export function getStack(offset?: number) {
  let error = new Error();

  // Not all browsers generate the `stack` property
  // Safari <=7 only, IE <=10 - 11 only
  if (!error.stack) {
    try {
      throw error;
    } catch (err: unknown) {
      error = err as Error;
    }
  }

  const stack = error.stack as string;
  const arr = stack.split("\n");
  arr.splice(1, offset != null && offset > 1 ? offset : 1);
  return arr.join("\n");
}

type Position = Readonly<{
  line?: Optional<number>;
  column?: Optional<number>;
}>;

export function positionToString(loc: Optional<Position>) {
  if (loc) {
    if (loc.line != null) {
      if (loc.column != null) {
        return `${loc.line}:${loc.column}`;
      }
      return `${loc.line}`;
    }
  }
  return "";
}

// TODO use https://nodejs.org/en/blog/release/v22.9.0#new-api-to-retrieve-execution-stack-trace

export function getCallSites(traceLimit: number = 20) {
  const target: { stack: readonly NodeJS.CallSite[] } = {} as any;

  const originalPrepare = Error.prepareStackTrace;
  const originalStackLimit = Error.stackTraceLimit;

  Error.stackTraceLimit = traceLimit;
  Error.prepareStackTrace = (error, stackTraces) => stackTraces;
  Error.captureStackTrace(target, getCallSites);

  const capturedTraces = target.stack;

  Error.prepareStackTrace = originalPrepare;
  Error.stackTraceLimit = originalStackLimit;

  return capturedTraces;
}

export function getCallSite(offset = 0) {
  return getCallSites(2 + offset)[1 + offset];
}
