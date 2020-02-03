export function get<K, V>(map: ReadonlyMap<K, V>, key: K): V {
  const value = map.get(key);
  if (value) {
    return value;
  }
  throw new Error("Assertion error");
}
