export class CounterMap<K> {
  private map: Map<K, number>;

  constructor() {
    this.map = new Map();
  }

  has(key: K) {
    return (this.map.get(key) ?? 0) > 0;
  }

  get(key: K): number {
    return this.map.get(key) ?? 0;
  }

  inc(key: K) {
    return this.plus(key, 1);
  }

  dec(key: K) {
    return this.minus(key, 1);
  }

  plus(key: K, amount: number) {
    const val = this.get(key) + amount;
    this.map.set(key, val);
    return val;
  }

  minus(key: K, amount: number) {
    const val = this.get(key) - amount;
    if (val <= 0) {
      this.map.delete(key);
      return 0;
    } else {
      this.map.set(key, val);
      return val;
    }
  }

  clear() {
    return this.map.clear();
  }

  entries() {
    return this.map.entries();
  }

  [Symbol.iterator]() {
    return this.map.keys();
  }
}
