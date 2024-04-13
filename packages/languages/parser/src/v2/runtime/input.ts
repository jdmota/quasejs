import { nonNull } from "../utils/index";
import { error } from "./error";
import { Stream } from "./stream";

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

export class Input extends Stream<number> {
  private ll1: { pos: number; line: number; column: number };
  private string: string;
  private size: number;
  private pos: number;

  constructor(opts: InputOpts) {
    super();
    this.ll1 = {
      pos: 0,
      line: 1,
      column: 0,
    };
    this.string = opts.string;
    this.size = opts.string.length;
    this.pos = 0;
  }

  position() {
    return this.pos;
  }

  protected override $next() {
    const code = this.codeAt(this.pos);
    this.pos += code < 0 ? 0 : code <= 0xffff ? 1 : 2;
    return code;
  }

  override $getPos() {
    return { ...this.ll1 };
  }

  override $ll1Id(): number {
    return this.$llArray[0];
  }

  override $advance() {
    const { ll1 } = this;
    const prev = nonNull(this.$llArray.shift());
    // "\r"
    if (prev === 13) {
      ll1.pos++;
      // "\n"
      if (this.$lookahead(1) === 10) {
        ll1.column++;
      } else {
        ll1.line++;
        ll1.column = 0;
      }
      // "\n"
    } else if (prev === 10) {
      ll1.pos++;
      ll1.line++;
      ll1.column = 0;
    } else {
      if (prev > 0xffff) {
        ll1.pos += 2;
        ll1.column += 2;
      } else if (prev >= 0) {
        ll1.pos++;
        ll1.column++;
      }
    }
  }

  // [start, end[
  text(start: number, end: number) {
    return this.string.slice(start, end);
  }

  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/codePointAt
  // https://mathiasbynens.be/notes/javascript-encoding#surrogate-formulae
  private codeAt(index: number) {
    const { string, size } = this;
    if (index < 0 || index >= size) {
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

  override $unexpected(
    pos: Position,
    found: number,
    expected?: string | number
  ): never {
    throw error(
      `Unexpected character ${String.fromCodePoint(found)} (code: ${found})${
        expected == null ? "" : `, expected ${expected}`
      }`,
      pos
    );
  }
}
