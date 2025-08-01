import redent, { type Options } from "redent";

export function findLoc(start: number, content: string) {
  const lines = content.slice(0, start).split(/\r?\n/);
  const line = lines.length;
  const column = lines.at(-1)?.length ?? 0;
  return { line, column };
}

export class StringBuilder {
  private currentIndent: number;
  private result: string;

  constructor(private readonly opts: Options) {
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

  newline() {
    this.result += "\n";
  }

  getResult() {
    return this.result;
  }
}
