import { error } from "./error.ts";
import { BufferedStream, Marker } from "./stream.ts";

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

export class Input extends BufferedStream<number> {
  private ll1: { pos: number; line: number; column: number };
  private string: string;
  private stringSize: number;
  private stringIdx: number;

  constructor(opts: InputOpts) {
    super();
    this.ll1 = {
      pos: 0,
      line: 1,
      column: 0,
    };
    this.string = opts.string;
    this.stringSize = opts.string.length;
    this.stringIdx = 0;
  }

  protected override fetchMore(amountFetched: number, amountToFetch: number) {
    while (amountToFetch--) {
      if (this.stringIdx < this.stringSize) {
        const code = this.string.codePointAt(this.stringIdx) as number;
        this.stringIdx += code <= 0xffff ? 1 : 2;
        this.buffer.push(code);
      }
    }
  }

  override advance(): void {
    super.advance();
    const { ll1 } = this;
    const prev = this.lookahead(0);
    // "\r"
    if (prev === 13) {
      ll1.pos++;
      // "\n"
      if (this.lookahead(1) === 10) {
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

  protected override eof(): number {
    return -1;
  }

  protected override oob(): number {
    throw new Error("Out of bounds");
  }

  $getPos(): Position {
    return { ...this.ll1 };
  }

  $getLoc(start: Position): Location {
    return { start, end: this.$getPos() };
  }

  $startText() {
    return this.mark();
  }

  $endText(marker: Marker) {
    return this.slice(marker, this.pos)
      .map(n => String.fromCodePoint(n))
      .join("");
  }

  $expect(id: number) {
    const found = this.lookahead(1);
    if (found === id) {
      this.advance();
      return found;
    }
    this.$unexpected(this.$getPos(), found, id);
  }

  $expect2(a: number, b: number) {
    const found = this.lookahead(1);
    if (a <= found && found <= b) {
      this.advance();
      return found;
    }
    this.$unexpected(this.$getPos(), found, a);
  }

  $unexpected(pos: Position, found: number, expected?: string | number): never {
    const char =
      found === -2
        ? "<OUT OF BOUNDS>"
        : found === -1
          ? "<EOF>"
          : String.fromCodePoint(found);
    throw error(
      `Unexpected character ${char} (code: ${found})${
        expected == null ? "" : `, expected ${expected}`
      }`,
      pos
    );
  }
}
