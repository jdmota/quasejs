import { RuntimeContext } from "./context";
import { error } from "./error";
import { Position, Location, Input } from "./input";
import { Stream } from "./stream";

export type Token = Readonly<{
  id: number;
  label: string;
  loc: Location;
  token: unknown;
}>;

export const FAKE_LOC: Location = {
  start: {
    pos: 0,
    line: 0,
    column: 0,
  },
  end: {
    pos: 0,
    line: 0,
    column: 0,
  },
};

type IdToChannels = Readonly<{
  [key: number]: readonly string[] | undefined;
}>;

export abstract class Tokenizer extends Stream<Token> {
  readonly ctx: RuntimeContext;
  private input: Input;
  private idToChannels: IdToChannels;
  private channels: { [key: string]: Token[] | undefined };

  constructor(input: Input) {
    super();
    this.ctx = new RuntimeContext();
    this.input = input;
    this.idToChannels = this.getIdToChannels();
    this.channels = {};
  }

  abstract token$lexer(): any;
  abstract getIdToChannels(): IdToChannels;

  protected override next(): Token {
    while (true) {
      //this.start = this.input.position();
      const token: Token = this.ctx.u(-1, this.token$lexer());
      //this.end = this.input.position();

      const channels = this.idToChannels[token.id];
      if (channels) {
        for (const chan of channels) {
          const array = this.channels[chan] || (this.channels[chan] = []);
          array.push(token);
        }
        continue;
      }

      return token;
    }
  }

  override ll1Loc() {
    return this.llArray[0].loc;
  }

  override ll1Id() {
    return this.llArray[0].id;
  }

  /*loc(): Location {
    return {
      start: this.start,
      end: this.input.position(),
    };
  }*/

  e(id: number) {
    return this.input.expect(id);
  }

  e2(a: number, b: number) {
    return this.input.expect2(a, b);
  }

  ll(n: number) {
    return this.input.lookahead(n);
  }

  err(): never {
    this.input.unexpected(this.input.ll1Loc(), this.input.lookahead(1));
  }

  override unexpected(
    loc: Location,
    found: Token,
    expected?: number | string
  ): never {
    throw error(
      `Unexpected token ${found.label}${
        expected == null ? "" : `, expected ${expected}`
      }`,
      loc.start
    );
  }

  /*makeToken(id: number, start: Position, end: Position): Token {
    if (id === -2) {
      return {
        id,
        label: "ERROR",
        image: this.input.text(start.pos, end.pos),
        loc: {
          start,
          end,
        },
      };
    }
    if (id === -1) {
      return {
        id,
        label: "EOF",
        image: "",
        loc: {
          start,
          end,
        },
      };
    }
    return {
      id,
      label: this.labels[id] || "UNKNOWN",
      image: this.input.text(start.pos, end.pos),
      loc: {
        start,
        end,
      },
    };
  }*/
}
