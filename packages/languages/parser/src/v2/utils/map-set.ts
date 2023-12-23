export class MapSet<K, V> {
  private readonly map = new Map<K, Set<V>>();

  get(key: K): Set<V> {
    let val = this.map.get(key);
    if (val == null) {
      val = new Set();
      this.map.set(key, val);
    }
    return val;
  }

  test(key: K, val: V) {
    return this.get(key).has(val);
  }

  add(key: K, val: V) {
    this.get(key).add(val);
  }

  addManyToOne(keys: Iterable<K>, value: V) {
    for (const key of keys) {
      const set = this.get(key);
      set.add(value);
    }
  }

  addOneToMany(key: K, values: Iterable<V>) {
    const set = this.get(key);
    for (const val of values) {
      set.add(val);
    }
  }

  addManyToMany(keys: Iterable<K>, values: Iterable<V>) {
    for (const key of keys) {
      const set = this.get(key);
      for (const val of values) {
        set.add(val);
      }
    }
  }

  addManyToMany2(keys: Iterable<K>, values: Iterable<V>, newPairs: [K, V][]) {
    for (const key of keys) {
      const set = this.get(key);
      for (const val of values) {
        const oldSize = set.size;
        set.add(val);
        if (set.size > oldSize) {
          newPairs.push([key, val]);
        }
      }
    }
  }

  *[Symbol.iterator]() {
    for (const [key, set] of this.map) {
      for (const value of set) {
        yield [key, value] as const;
      }
    }
  }
}
