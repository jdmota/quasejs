import { RuntimeContext } from "./context.ts";
import { error } from "./error.ts";
import { GLL } from "./gll.ts";
import { Position, Location, Input } from "./input.ts";
import { BufferedStream, Marker } from "./stream.ts";

export type Token = Readonly<{
  id: number;
  token: unknown;
  $loc: Location;
}>;

type IdToChannels = Readonly<{
  [key: number]: Readonly<{ s: boolean; c: readonly string[] }>;
}>;

type IdToLabel = Readonly<{
  [key: number]: string;
}>;

export abstract class Tokenizer<T> extends BufferedStream<Token> {
  readonly ctx: RuntimeContext;
  readonly external: T;
  private input: Input;
  private idToLabels: IdToLabel;
  private idToChannels: IdToChannels;
  private channels: { [key: string]: Token[] | undefined };
  protected gll: GLL | null;

  constructor(input: Input, external: T) {
    super();
    this.ctx = new RuntimeContext();
    this.input = input;
    this.external = external;
    this.idToLabels = this.$getIdToLabel();
    this.idToChannels = this.$getIdToChannels();
    this.channels = {};
    this.gll = null;
  }

  $setGLL(gll: GLL) {
    this.gll = gll;
  }

  protected override fetchMore(amountFetched: number, amountToFetch: number) {
    while (amountToFetch--) {
      while (true) {
        const token = this.token$lexer_0();
        const channels = this.idToChannels[token.id];
        for (const chan of channels.c) {
          const array = this.channels[chan] || (this.channels[chan] = []);
          array.push(token);
        }
        if (channels.s) {
          continue; // Skip
        }
        this.buffer.push(token);
        break;
      }
    }
  }

  protected override eof(): Token {
    throw new Error("Unreachable");
  }

  protected override oob(): Token {
    throw new Error("Out of bounds");
  }

  abstract token$lexer_0(): Token;
  abstract $getIdToChannels(): IdToChannels;
  abstract $getIdToLabel(): IdToLabel;

  $startText() {
    return this.input.mark();
  }

  $endText(marker: Marker) {
    return this.input.$endText(marker);
  }

  $getPos(): Position {
    return this.input.$getPos();
  }

  $getLoc(start: Position): Location {
    return { start, end: this.$getPos() };
  }

  $e(id: number) {
    return this.input.$expect(id);
  }

  $e2(a: number, b: number) {
    return this.input.$expect2(a, b);
  }

  $ll(n: number) {
    return this.input.lookahead(n);
  }

  $err(): never {
    this.input.$unexpected(this.input.$getPos(), this.input.lookahead(1));
  }

  $expect(id: number) {
    const pos = this.$getPos();
    const token = this.lookahead(1);
    const foundId = token.id;
    if (foundId === id) {
      this.advance();
      return token;
    }
    this.$unexpected(pos, token, id);
  }

  $expect2(a: number, b: number) {
    const pos = this.$getPos();
    const token = this.lookahead(1);
    const foundId = token.id;
    if (a <= foundId && foundId <= b) {
      this.advance();
      return token;
    }
    this.$unexpected(pos, token, a);
  }

  $unexpected(pos: Position, found: Token, expected?: number | string): never {
    throw error(
      `Unexpected token ${this.idToLabels[found.id]}${
        expected == null
          ? ""
          : `, expected ${
              typeof expected === "number"
                ? this.idToLabels[expected]
                : expected
            }`
      }`,
      pos
    );
  }

  $i() {
    return this.input.index();
  }
}
