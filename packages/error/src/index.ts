import stackParser from "error-stack-parser";
import { slash, prettify } from "../../util/path-url";

export const ignoreStackTraceRe =
  /StackTrace\$\$|ErrorStackParser\$\$|StackTraceGPS\$\$|StackGenerator\$\$/;
export const ignoreFileRe =
  /^([^()\s]*\/quasejs\/packages\/[^()\s/]+\/dist\/[^()\s]*|[^()\s]*\/node_modules\/@quase\/[^()\s]+|[^()\s/]+\.js|internal(\/[^()\s/]+)?\/[^()\s]+\.js|native)$/;

type Opts = Readonly<{
  extractor?: any;
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
      const stackLine = {
        textLine: "",
        file: fileName,
        code: null,
        name: functionName,
        line: lineNumber,
        column: columnNumber,
      };

      if (extractor) {
        try {
          const pos = await extractor.getOriginalLocation(stackLine.file, {
            line: stackLine.line,
            column: stackLine.column,
          });
          if (pos.line == null) {
            stackLine.code = pos.code;
          } else {
            stackLine.file = pos.originalFile;
            stackLine.code = pos.originalCode;
            stackLine.name = pos.name || stackLine.name;
            stackLine.line = pos.line;
            stackLine.column = pos.column;
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
      `${textLine} (${prettify(file)}:${line}:${column})`
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
