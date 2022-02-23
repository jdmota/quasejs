import { Position, Location } from "./input";
import { Token, Tokenizer } from "./tokenizer";
import { error } from "./error";

export class Parser {
  tokenizer: Tokenizer;
  lastTokenEnd: Position;
  token: Token;

  constructor(tokenizer: Tokenizer) {
    this.tokenizer = tokenizer;
    this.token = this.tokenizer.nextToken();
    this.lastTokenEnd = this.token.loc.start;
  }

  startNode(): Position {
    return this.token.loc.start;
  }

  endNode(): Position {
    return this.lastTokenEnd;
  }

  locNode(start: Position): Location {
    return {
      start,
      end: this.endNode(),
    };
  }

  advance() {
    this.lastTokenEnd = this.token.loc.end;
    this.token = this.tokenizer.nextToken();
  }

  expect1(id: number) {
    const token = this.token;
    if (token.id === id) {
      this.advance();
      return token;
    }
    this.unexpected(id);
  }

  expect2(a: number, b: number) {
    const token = this.token;
    if (a <= token.id && token.id <= b) {
      this.advance();
      return token;
    }
    this.unexpected(a);
  }

  unexpected(id?: number | string) {
    throw error(
      `Unexpected token ${this.token.label}${
        id == null ? "" : `, expected ${id}`
      }`,
      this.token.loc.start
    );
  }

  getChannels() {
    return this.tokenizer.channels;
  }

  parse() {
    throw new Error("Abstract");
  }
}
