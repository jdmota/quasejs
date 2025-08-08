export class DefaultMap<K, Arg, V> {
  private map: Map<K, V>;
  private defaultValue: (key: Arg) => V;

  constructor(defaultValue: (key: Arg) => V) {
    this.map = new Map();
    this.defaultValue = defaultValue;
  }

  get(key: K, arg: Arg): V {
    let val = this.map.get(key);
    // Assume V is not undefined
    if (val === undefined) {
      val = this.defaultValue(arg);
      this.map.set(key, val);
    }
    return val;
  }

  maybeGet(key: K) {
    return this.map.get(key);
  }

  delete(key: K) {
    return this.map.delete(key);
  }

  clear() {
    return this.map.clear();
  }

  keys() {
    return this.map.keys();
  }

  values() {
    return this.map.values();
  }

  entries() {
    return this.map.entries();
  }

  [Symbol.iterator]() {
    return this.map.entries();
  }
}
