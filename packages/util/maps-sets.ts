export function setAdd<T>(set: Set<T>, value: T) {
  const size = set.size;
  set.add(value);
  return size < set.size;
}

export function get<K, V>(map: ReadonlyMap<K, V>, key: K): V {
  const value = map.get(key);
  if (value) {
    return value;
  }
  throw new Error("Assertion error");
}

export function getSet<K, V>(map: Map<K, Set<V>>, key: K): Set<V> {
  let set = map.get(key);
  if (set) return set;
  set = new Set();
  map.set(key, set);
  return set;
}

export function copy<V>(a: ReadonlySet<V>, b: Set<V>): boolean {
  const originalSize = b.size;
  for (const value of a) {
    b.add(value);
  }
  return originalSize < b.size;
}

export function intersection<V>(a: ReadonlySet<V>, b: ReadonlySet<V>): Set<V> {
  const set = new Set<V>();
  for (const value of a) {
    if (b.has(value)) set.add(value);
  }
  return set;
}
