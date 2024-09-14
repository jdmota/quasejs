import stackParser from "error-stack-parser";
import { slash, prettify } from "../../util/path-url";
import { type SourceMapExtractor } from "../../source-map/src/extractor";

export const ignoreStackTraceRe =
  /StackTrace\$\$|ErrorStackParser\$\$|StackTraceGPS\$\$|StackGenerator\$\$/;
export const ignoreFileRe =
  /^([^()\s]*\/quasejs\/packages\/[^()\s/]+\/dist\/[^()\s]*|[^()\s]*\/node_modules\/@quase\/[^()\s]+|[^()\s/]+\.js|node:[^()\s]+|internal(\/[^()\s/]+)?\/[^()\s]+\.js|native)$/;

type Opts = Readonly<{
  extractor?: SourceMapExtractor;
  ignore?:
    | {
        test(text: string): boolean;
      }
    | null
    | undefined;
}>;

type StackFrame = stackParser.StackFrame & { fileName: string };

function excludeFramesWithoutFilename(
  v: stackParser.StackFrame
): v is StackFrame {
  return !!v.fileName;
}

export type BeautifiedStackLine = {
  textLine: string;
  file: string | null;
  code: string | null;
  name: string | null;
  line: number | null;
  column: number | null;
};

export async function beautify(originalStack: string = "", options: Opts = {}) {
  const extractor = options && options.extractor;
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

  const promises = frames.map(
    async ({ fileName, functionName, args, lineNumber, columnNumber }) => {
      const stackLine: BeautifiedStackLine = {
        textLine: "",
        file: fileName,
        code: null,
        name: functionName ?? null,
        line: lineNumber ?? null,
        column: columnNumber ?? null,
      };

      if (extractor && stackLine.line && stackLine.column) {
        try {
          const pos = await extractor.getOriginalLocation(fileName, {
            line: stackLine.line,
            column: stackLine.column,
          });
          if ("line" in pos) {
            stackLine.file = pos.originalFile;
            stackLine.code = pos.originalCode;
            stackLine.name = pos.name || stackLine.name;
            stackLine.line = pos.line;
            stackLine.column = pos.column;
          } else {
            stackLine.code = pos.code;
          }
        } catch (e) {
          // Ignore
        }
      }

      stackLine.textLine = `${stackLine.name}${
        args ? `(${args.join(", ")})` : ""
      }`;
      return stackLine;
    }
  );

  const cleaned = await Promise.all(promises);
  const cleanedText = cleaned.map(
    ({ textLine, file, line, column }) =>
      `${textLine} (${file ? prettify(file) : "<unknown file>"}:${line}:${column})`
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

type Loc = Readonly<{
  line?: number | null | undefined;
  column?: number | null | undefined;
}>;

export function locToString(loc: Loc) {
  if (loc.line != null) {
    if (loc.column != null) {
      return `${loc.line}:${loc.column}`;
    }
    return `${loc.line}`;
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
