export class MapArray<K, V> {
  private readonly map = new Map<K, V[]>();

  get(key: K): V[] {
    let val = this.map.get(key);
    if (val == null) {
      val = [];
      this.map.set(key, val);
    }
    return val;
  }

  clearMany(key: K) {
    this.map.delete(key);
  }

  add(key: K, val: V) {
    this.get(key).push(val);
  }

  *[Symbol.iterator]() {
    for (const [key, set] of this.map) {
      for (const value of set) {
        yield [key, value] as const;
      }
    }
  }
}
