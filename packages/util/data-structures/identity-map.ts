export class IdentityMap<K, V> extends Map<K, V> {
  computeIfAbsent(key: K, fn: (key: K) => V): V {
    let val = this.get(key);
    if (val === undefined) {
      val = fn(key);
      this.set(key, val);
    }
    return val;
  }
}
