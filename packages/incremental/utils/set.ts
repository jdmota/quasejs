export function setAdd<T>(set: Set<T>, value: T) {
  const size = set.size;
  set.add(value);
  return size < set.size;
}
