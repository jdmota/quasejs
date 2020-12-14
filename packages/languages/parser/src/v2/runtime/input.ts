export type Position = Readonly<{
  pos: number;
  line: number;
  column: number;
}>;

export type Location = Readonly<{
  start: Position;
  end: Position;
}>;

export type InputOpts = Readonly<{
  string: string;
}>;

export class Input {
  pos: number;
  current: number;
  line: number;
  column: number;
  string: string;
  size: number;

  private constructor() {
    this.pos = 0;
    this.line = 1;
    this.column = 0;
    this.current = -1;
    this.string = "";
    this.size = 0;
  }

  static new(opts: InputOpts) {
    const input = new Input();
    input.string = opts.string;
    input.size = opts.string.length;
    input.current = input.codeAt(0);
    return input;
  }

  clone() {
    const input = new Input();
    input.pos = this.pos;
    input.line = this.line;
    input.column = this.column;
    input.current = this.current;
    input.string = this.string;
    input.size = this.size;
    return input;
  }

  position(): Position {
    return {
      pos: this.pos,
      line: this.line,
      column: this.column,
    };
  }

  advance() {
    const { current: prev } = this;
    // "\r"
    if (prev === 13) {
      this.pos++;
      this.current = this.codeAt(this.pos);
      // "\n"
      if (this.current === 10) {
        this.column++;
      } else {
        this.line++;
        this.column = 0;
      }
      // "\n"
    } else if (prev === 10) {
      this.pos++;
      this.current = this.codeAt(this.pos);
      this.line++;
      this.column = 0;
    } else {
      if (prev > 0xffff) {
        this.pos += 2;
        this.column += 2;
      } else {
        this.pos++;
        this.column++;
      }
      this.current = this.codeAt(this.pos);
    }
  }

  // [start, end[
  text(start: number, end: number) {
    return this.string.slice(start, end);
  }

  eof() {
    return this.pos >= this.size;
  }

  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/codePointAt
  // https://mathiasbynens.be/notes/javascript-encoding#surrogate-formulae
  codeAt(index: number) {
    const { string, size } = this;
    if (index < 0 || index >= this.size) {
      return -1;
    }

    const first = string.charCodeAt(index);
    if (first >= 0xd800 && first <= 0xdbff && size > index + 1) {
      const second = string.charCodeAt(index + 1);
      if (second >= 0xdc00 && second <= 0xdfff) {
        return (first - 0xd800) * 0x400 + second - 0xdc00 + 0x10000;
      }
    }
    return first;
  }
}
