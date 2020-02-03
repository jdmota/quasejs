export class KeyToArray<K, V> {
  private map: Map<K, V[]>;

  constructor() {
    this.map = new Map();
  }

  get(key: K): V[] {
    let arr = this.map.get(key);
    if (!arr) {
      arr = [];
      this.map.set(key, arr);
    }
    return arr;
  }

  set(key: K, value: V) {
    const arr = this.map.get(key);
    if (arr) {
      arr.push(value);
    } else {
      this.map.set(key, [value]);
    }
  }

  allValues() {
    const all = new Set<V>();
    for (const files of this.map.values()) {
      for (const file of files) {
        all.add(file);
      }
    }
    return all;
  }

  values() {
    return this.map.values();
  }
}
