import { MapRangeToValue } from "./map-range-to-value";

type Range = { from: number; to: number };

export class RangeSet {
  private readonly map: MapRangeToValue<null>;

  constructor() {
    this.map = new MapRangeToValue();
  }

  add(range: Range) {
    this.map.addRange(range.from, range.to, null);
  }

  *[Symbol.iterator](): IterableIterator<Range> {
    for (const [range] of this.map) {
      yield range;
    }
  }
}
