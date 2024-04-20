import { Position } from "./input.ts";

export abstract class Stream<T> {
  protected $llArray: T[];
  private $lastToken: T | undefined;

  constructor() {
    this.$llArray = [];
  }

  protected abstract $next(): T;

  abstract $getPos(): Position;

  // pre: this.lookahead.length > 0
  abstract $ll1Id(): number;

  // pre: this.lookahead.length > 0
  $advance() {
    this.$lastToken = this.$llArray.shift();
  }

  $getLast() {
    return this.$lastToken;
  }

  $lookahead(n: number) {
    const { $llArray: lookahead } = this;
    while (lookahead.length < n) {
      lookahead.push(this.$next());
    }
    return lookahead[n - 1];
  }

  $expect(id: number) {
    const token = this.$lookahead(1);
    const foundId = this.$ll1Id();
    if (foundId === id) {
      this.$advance();
      return token;
    }
    this.$unexpected(this.$getPos(), token, id);
  }

  $expect2(a: number, b: number) {
    const token = this.$lookahead(1);
    const foundId = this.$ll1Id();
    if (a <= foundId && foundId <= b) {
      this.$advance();
      return token;
    }
    this.$unexpected(this.$getPos(), token, a);
  }

  abstract $unexpected(
    pos: Position,
    found: T,
    expected?: number | string
  ): never;
}
