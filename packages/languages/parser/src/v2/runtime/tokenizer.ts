import { RuntimeContext } from "./context.ts";
import { error } from "./error.ts";
import { Position, Location, Input } from "./input.ts";
import { Stream } from "./stream.ts";

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

export abstract class Tokenizer<T> extends Stream<Token> {
  readonly ctx: RuntimeContext;
  readonly external: T;
  private input: Input;
  private idToLabels: IdToLabel;
  private idToChannels: IdToChannels;
  private channels: { [key: string]: Token[] | undefined };

  constructor(input: Input, external: T) {
    super();
    this.ctx = new RuntimeContext();
    this.input = input;
    this.external = external;
    this.idToLabels = this.$getIdToLabel();
    this.idToChannels = this.$getIdToChannels();
    this.channels = {};
  }

  abstract token$lexer(): Token;
  abstract $getIdToChannels(): IdToChannels;
  abstract $getIdToLabel(): IdToLabel;

  $getIndex() {
    return this.input.position();
  }

  $getText(start: number) {
    const end = this.input.position();
    return this.input.text(start, end);
  }

  $getPos(): Position {
    return this.input.$getPos();
  }

  $getLoc(start: Position): Location {
    return { start, end: this.$getPos() };
  }

  protected override $next(): Token {
    while (true) {
      const token = this.token$lexer();
      const channels = this.idToChannels[token.id];
      for (const chan of channels.c) {
        const array = this.channels[chan] || (this.channels[chan] = []);
        array.push(token);
      }
      if (channels.s) {
        continue; // Skip
      }
      return token;
    }
  }

  override $ll1Id() {
    return this.$llArray[0].id;
  }

  $e(id: number) {
    return this.input.$expect(id);
  }

  $e2(a: number, b: number) {
    return this.input.$expect2(a, b);
  }

  $ll(n: number) {
    return this.input.$lookahead(n);
  }

  $err(): never {
    this.input.$unexpected(this.input.$getPos(), this.input.$lookahead(1));
  }

  override $unexpected(
    pos: Position,
    found: Token,
    expected?: number | string
  ): never {
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
}
