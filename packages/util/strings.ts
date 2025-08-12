import redent, { type Options } from "redent";

export function countNewLineChars(string: string, end: number = string.length) {
  let c = 0;
  for (let i = 0; i < end; i++) {
    const code = string.charCodeAt(i);
    if (code === 10) {
      c++;
    } else if (code === 13) {
      c++;
      if (string.charCodeAt(i + 1) === 10) {
        i++;
      }
    }
  }
  return c;
}

export function findLoc(start: number, content: string) {
  const lines = content.slice(0, start).split(/\r?\n/);
  const line = lines.length;
  const column = lines.at(-1)?.length ?? 0;
  return { line, column };
}

export class StringBuilder {
  private currentIndent: number;
  private result: string;

  constructor(private readonly opts: Options = { indent: "  " }) {
    this.currentIndent = 0;
    this.result = "";
  }

  indent() {
    this.currentIndent++;
  }

  unindent() {
    this.currentIndent--;
  }

  add(str: string) {
    this.result += redent(str, this.currentIndent, this.opts);
  }

  line(str: string) {
    this.add(str + "\n");
  }

  stmt(str: string) {
    this.add(str + ";\n");
  }

  return(str: string) {
    this.add(`return ${str};\n`);
  }

  toString() {
    return this.result;
  }
}
