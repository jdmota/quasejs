import { Position, Location } from "./input";
import { Token, Tokenizer } from "./tokenizer";
import { error } from "./error";
import { RuntimeContext } from "./context";

export abstract class Parser<T> {
  readonly ctx: RuntimeContext;
  readonly external: T;
  private tokenizer: Tokenizer<T>;

  constructor(tokenizer: Tokenizer<T>, external: T) {
    this.ctx = new RuntimeContext();
    this.tokenizer = tokenizer;
    this.external = external;
  }

  /*startNode(): Position {
    return this.token.loc.start;
  }

  endNode(): Position {
    return this.lastTokenEnd;
  }*/

  /*locNode(start: Position): Location {
    return {
      start,
      end: this.endNode(),
    };
  }*/

  e(id: number) {
    return this.tokenizer.expect(id);
  }

  e2(a: number, b: number) {
    return this.tokenizer.expect2(a, b);
  }

  ll(n: number) {
    return this.tokenizer.lookahead(n).id;
  }

  err(): never {
    this.tokenizer.unexpected(
      this.tokenizer.ll1Loc(),
      this.tokenizer.lookahead(1)
    );
  }
}
