export class RoundRobin<T>
  implements IterableIterator<T, undefined, undefined>
{
  private iterator: Iterator<T, undefined, undefined>;

  constructor(private readonly iterable: Iterable<T, undefined, undefined>) {
    this.iterator = iterable[Symbol.iterator]();
  }

  next(): IteratorResult<T, undefined> {
    const result = this.iterator.next();
    if (result.done) {
      this.iterator = this.iterable[Symbol.iterator]();
      return this.iterator.next();
    }
    return result;
  }

  [Symbol.iterator](): IterableIterator<T, undefined, undefined> {
    return this;
  }
}

export function roundRobin<T>(iterable: Iterable<T, undefined, undefined>) {
  return new RoundRobin(iterable);
}
