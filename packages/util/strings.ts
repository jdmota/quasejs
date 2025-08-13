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
    return this;
  }

  unindent() {
    this.currentIndent--;
    return this;
  }

  block(fn: (s: StringBuilder) => void) {
    this.indent();
    fn(this);
    this.unindent();
    return this;
  }

  add(str: string, opts = { trimLeftNewLine: true }) {
    let redented = redent(str, this.currentIndent, this.opts);
    if (opts.trimLeftNewLine) {
      if (redented.startsWith("\n")) {
        redented = redented.slice(1);
      }
    }
    this.result += redented;
    return this;
  }

  line(str: string, opts = { trimLeftNewLine: true }) {
    return this.add(str + "\n", opts);
  }

  stmt(str: string) {
    return this.add(str + ";\n");
  }

  return(str: string) {
    return this.add(`return ${str};\n`);
  }

  toString() {
    return this.result;
  }
}
