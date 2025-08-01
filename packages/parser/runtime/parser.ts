import { Tokenizer } from "./tokenizer.ts";
import { RuntimeContext } from "./context.ts";
import { type Location, type Position } from "./input.ts";
import { GLL } from "./gll.ts";

export abstract class Parser<T> {
  readonly ctx: RuntimeContext;
  readonly external: T;
  private tokenizer: Tokenizer<T>;
  protected gll: GLL | null;

  constructor(tokenizer: Tokenizer<T>, external: T) {
    this.ctx = new RuntimeContext();
    this.tokenizer = tokenizer;
    this.external = external;
    this.gll = null;
    tokenizer.mark(); // TODO optimize to allow buffer to be released
  }

  $jump(pos: number) {
    this.tokenizer.seek(pos);
  }

  $setGLL(gll: GLL) {
    this.gll = gll;
  }

  $getPos() {
    return this.tokenizer.lookahead(1).$loc.start;
  }

  $getLoc(start: Position): Location {
    const possibleEnd = this.tokenizer.lookahead(0).$loc.end;
    return {
      start,
      end: possibleEnd.pos < start.pos ? start : possibleEnd, // Deal with empty rules
    };
  }

  $e(id: number) {
    return this.tokenizer.$expect(id).token;
  }

  $e2(a: number, b: number) {
    return this.tokenizer.$expect2(a, b).token;
  }

  $ll(n: number) {
    return this.tokenizer.lookahead(n).id;
  }

  $ff(n: number) {
    return this.ctx.ff(n);
  }

  $c(b: boolean) {
    this.ctx.c(b);
  }

  $err(): never {
    this.tokenizer.$unexpected(
      this.tokenizer.$getPos(),
      this.tokenizer.lookahead(1)
    );
  }

  $i() {
    return this.tokenizer.index();
  }
}
