import { error } from "./error";
import { Position, Location, Input } from "./input";

export type Token = Readonly<{
  id: number;
  label: string;
  image: string;
  loc: Location;
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

export class Tokenizer {
  input: Input;
  labels: { [key: number]: string | undefined };
  idToChannels: { [key: number]: string | undefined };
  channels: { [key: string]: Token[] | undefined };
  start: Position;

  constructor(string: string) {
    this.input = Input.new({ string });
    this.labels = [];
    this.idToChannels = {};
    this.channels = {};
    this.start = this.input.position();
  }

  unexpected() {
    const { current } = this.input;
    throw error(
      `Unexpected character ${String.fromCodePoint(current)} ${current}`,
      this.start
    );
  }

  loc(): Location {
    return {
      start: this.start,
      end: this.input.position(),
    };
  }

  readToken(): number {
    throw new Error("Abstract");
  }

  expect1(code: number) {
    const { current } = this.input;
    if (current === code) {
      this.input.advance();
      return current;
    }
    this.unexpected();
  }

  expect2(a: number, b: number) {
    const { current } = this.input;
    if (a <= current && current <= b) {
      this.input.advance();
      return current;
    }
    this.unexpected();
  }

  makeToken(id: number, start: Position, end: Position): Token {
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
  }

  nextTokenId(): number {
    while (true) {
      this.start = this.input.position();

      if (this.input.eof()) {
        return -1;
      }

      const tokenId = this.readToken();
      const channels = this.idToChannels[tokenId];
      if (channels) {
        for (const chan of channels) {
          const array = this.channels[chan] || (this.channels[chan] = []);
          array.push(
            this.makeToken(tokenId, this.start, this.input.position())
          );
        }
        continue;
      }

      return tokenId;
    }
  }

  nextToken(): Token {
    const tokenId = this.nextTokenId();
    return this.makeToken(tokenId, this.start, this.input.position());
  }
}
