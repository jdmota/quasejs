import { Position, Location, Tokenizer } from "./tokenizer";
import { error } from "./error";

export class Parser<Token extends { label: string }> {
  tokenizer: Tokenizer<Token>;
  token: Token;
  tokenLoc: Location;
  start: Position;
  lastTokenEnd: Position;
  lookaheadState: { token: Token; loc: Location } | null;

  constructor(tokenizer: Tokenizer<Token>) {
    this.tokenizer = tokenizer;
    this.start = { pos: 0, line: 0, column: 0 };
    this.lastTokenEnd = this.start;
    this.token = this.tokenizer.nextToken();
    this.tokenLoc = this.tokenizer.loc();
    this.lookaheadState = null;
  }

  startNode(): Position {
    return this.tokenLoc.start;
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

  error(message: string, pos?: Position) {
    throw error(message, pos || this.tokenLoc.start);
  }

  // Returns the next current token
  next(): Token {
    this.lastTokenEnd = this.tokenLoc.end;

    if (this.lookaheadState) {
      this.token = this.lookaheadState.token;
      this.tokenLoc = this.lookaheadState.loc;
      this.lookaheadState = null;
    } else {
      this.token = this.tokenizer.nextToken();
      this.tokenLoc = this.tokenizer.loc();
    }

    return this.token;
  }

  match(t: string | Token): boolean {
    return typeof t === "object" ? this.token === t : this.token.label === t;
  }

  eat(t: string | Token): Token | null {
    const token = this.token;
    if (this.match(t)) {
      this.next();
      return token;
    }
    return null;
  }

  expect(t: string | Token): Token {
    const token = this.eat(t);
    if (token == null) {
      throw this.error(
        `Unexpected token ${this.token.label}, expected ${
          typeof t === "object" ? t.label : t
        }`
      );
    }
    return token;
  }

  unexpected(t?: Token) {
    throw this.error(
      `Unexpected token ${this.token.label}${t ? `, expected ${t.label}` : ""}`
    );
  }

  lookahead(): Token {
    if (!this.lookaheadState) {
      this.lookaheadState = {
        token: this.tokenizer.nextToken(),
        loc: this.tokenizer.loc(),
      };
    }
    return this.lookaheadState.token;
  }

  parse() {
    throw new Error("Abstract");
  }
}
