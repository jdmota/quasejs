import { Location, Position } from "./input";

export abstract class Stream<T> {
  protected llArray: T[];

  constructor() {
    this.llArray = [];
  }

  protected abstract next(): T;

  abstract getPos(): Position;

  // pre: this.lookahead.length > 0
  abstract ll1Loc(): Location;

  // pre: this.lookahead.length > 0
  abstract ll1Id(): number;

  // pre: this.lookahead.length > 0
  advance() {
    this.llArray.shift();
  }

  lookahead(n: number) {
    const { llArray: lookahead } = this;
    while (lookahead.length < n) {
      lookahead.push(this.next());
    }
    return lookahead[n - 1];
  }

  expect(id: number) {
    const token = this.lookahead(1);
    const foundId = this.ll1Id();
    if (foundId === id) {
      this.advance();
      return token;
    }
    this.unexpected(this.ll1Loc(), token, id);
  }

  expect2(a: number, b: number) {
    const token = this.lookahead(1);
    const foundId = this.ll1Id();
    if (a <= foundId && foundId <= b) {
      this.advance();
      return token;
    }
    this.unexpected(this.ll1Loc(), token, a);
  }

  abstract unexpected(
    loc: Location,
    found: T,
    expected?: number | string
  ): never;
}
