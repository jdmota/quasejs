export function* joinIterators<T>(
  a: IterableIterator<T>,
  b: IterableIterator<T>
): IterableIterator<T> {
  for (const elem of a) {
    yield elem;
  }
  for (const elem of b) {
    yield elem;
  }
}
