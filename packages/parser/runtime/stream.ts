class Markers {
  // invariant: minMarkedPos == -1 || minMarkedPos >= 0
  private markers = new Set<Marker>();
  private minMarkedPos = -1;

  min() {
    return this.minMarkedPos;
  }

  mark(pos: number): Marker {
    const m = { pos: pos };
    this.markers.add(m);
    // Update minimum marker
    if (this.minMarkedPos === -1 || pos < this.minMarkedPos) {
      this.minMarkedPos = pos;
    }
    return m;
  }

  release(marker: Marker) {
    if (this.markers.delete(marker)) {
      // Update minimum marker
      if (marker.pos === this.minMarkedPos) {
        let min = -1;
        for (const { pos } of this.markers) {
          if (min === -1 || pos < min) {
            min = pos;
          }
        }
        this.minMarkedPos = min;
      }
    }
  }
}

// Inspiration https://github.com/antlr/antlr4/blob/dev/runtime/Java/src/org/antlr/v4/runtime/IntStream.java

export abstract class IStream<T> {
  protected pos: number = 0;

  index() {
    return this.pos;
  }

  seek(pos: number) {
    this.pos = pos;
  }

  advance() {
    this.pos++;
  }

  abstract get(pos: number): T;

  // LA(1) gives the current token in position 'pos'
  // LA(0) gives the previous token (if available)
  // LA with negative number may fail
  lookahead(n: number): T {
    return this.get(this.pos + n - 1);
  }

  // If 'end' is undefined, it slices until 'this.pos'
  abstract slice(marker: Marker, end: number | undefined): T[];

  abstract mark(): Marker;

  abstract release(marker: Marker): void;
}

export class StreamView<T, S extends BufferedStream<T>> extends IStream<T> {
  private underlying: S;
  private marker: Marker;

  constructor(underlying: S) {
    super();
    this.underlying = underlying;
    this.marker = underlying.mark();
    this.pos = this.marker.pos;
  }

  get(pos: number) {
    return this.underlying.get(pos);
  }

  slice(marker: Marker, end = this.pos) {
    return this.underlying.slice(marker, end);
  }

  mark() {
    return this.underlying.mark();
  }

  release(marker: Marker) {
    this.underlying.release(marker);
  }

  drop() {
    this.underlying.release(this.marker);
  }
}

export type Marker = { readonly pos: number };

export abstract class BufferedStream<T> extends IStream<T> {
  // invariant: this.released <= this.pos
  // invariant: all 'pos' values >= 0 and 0-based
  // invariant: all 'amount' values >= 0 and 1-based

  protected buffer: T[] = []; // buffer contains tokens in the range [this.released, this.released + this.buffer.length[
  protected released = 0;

  // End-of-file
  protected abstract eof(): T;

  // Out-of-bounds
  protected abstract oob(): T;

  protected abstract fetchMore(
    amountFetched: number,
    amountToFetch: number
  ): void;

  private ensureFetched(amount: number) {
    /* e.g.
    released = 3 // [a,b,c]
    buffer = [d,e,f,g,h]
    amount = 14

    amountFetched = 3 + 5 = 8
    amountToFetch = 14 - 8 = 6
    */
    const amountFetched = this.released + this.buffer.length;
    const amountToFetch = amount - amountFetched;
    if (amountToFetch <= 0) return;
    this.fetchMore(amountFetched, amountToFetch);
    /* e.g.
    released = 3 // [a,b,c]
    buffer = [d,e,f,g,h,i,j,k,l,m,n]
    amount = 14

    [new] amountFetched = 3 + 11 = 14
    */
  }

  private gc() {
    const minMarkedPos = this.markers.min();
    const minPos =
      minMarkedPos === -1 ? this.pos : Math.min(minMarkedPos, this.pos);
    /* e.g.
    released = 3 // [a,b,c]
    buffer = [d,e,f,g,h]
    minPos = 5 ('f')
    amountToRelease = 5 - 3 - 1 = 1
    */
    // Minus 1 to keep the previous token always
    const amountToRelease = minPos - this.released - 1;
    if (amountToRelease <= 0) return;
    // Release fetched
    this.released += amountToRelease;
    let amount = amountToRelease;
    while (amount--) {
      this.buffer.shift();
    }
  }

  // pos >= this.released
  // override seek(pos: number)

  override advance() {
    super.advance();
    this.gc();
  }

  get(pos: number): T {
    this.ensureFetched(pos + 1);
    const i = pos - this.released;
    if (i >= this.buffer.length) return this.eof();
    if (i < 0) return this.oob();
    return this.buffer[i];
  }

  slice(marker: Marker, endPos = this.pos) {
    const start = marker.pos - this.released;
    const end = endPos - this.released;
    return this.buffer.slice(start, end);
  }

  private markers = new Markers();

  mark(): Marker {
    return this.markers.mark(this.pos);
  }

  release(marker: Marker) {
    this.markers.release(marker);
  }

  view(): StreamView<T, this> {
    return new StreamView(this);
  }
}
