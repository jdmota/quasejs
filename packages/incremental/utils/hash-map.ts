import { LinkedList } from "./linked-list";

type HashMapEntry<K, V> = {
  readonly key: K;
  value: V;
};

export interface ReadonlyHashMap<K, V> {
  get(key: K): V | undefined;
  [Symbol.iterator](): IterableIterator<readonly [K, V]>;
}

export class HashMap<K, V> implements ReadonlyHashMap<K, V> {
  private readonly map: Map<number, LinkedList<HashMapEntry<K, V>>>;
  private readonly hash: (key: K) => number;
  private readonly equal: (a: K, b: K) => boolean;

  constructor(hash: (key: K) => number, equal: (a: K, b: K) => boolean) {
    this.map = new Map();
    this.hash = hash;
    this.equal = equal;
  }

  get(key: K): V | undefined {
    return this.map
      .get(this.hash(key))
      ?.find(entry => this.equal(entry.key, key))?.value;
  }

  delete(key: K): V | undefined {
    return this.map
      .get(this.hash(key))
      ?.remove(entry => this.equal(entry.key, key))?.value;
  }

  set(key: K, value: V) {
    const hash = this.hash(key);

    let list = this.map.get(hash);
    if (list === undefined) {
      list = new LinkedList();
      this.map.set(hash, list);
    }

    let entry = list.find(entry => this.equal(entry.key, key));
    if (entry === undefined) {
      entry = {
        key,
        value,
      };
      list.addLast(entry);
    } else {
      entry.value = value;
    }
  }

  computeIfAbsent(key: K, fn: (key: K) => V): V {
    const hash = this.hash(key);

    let list = this.map.get(hash);
    if (list === undefined) {
      list = new LinkedList();
      this.map.set(hash, list);
    }

    let entry = list.find(entry => this.equal(entry.key, key));
    if (entry === undefined) {
      entry = {
        key,
        value: fn(key),
      };
      list.addLast(entry);
    }
    return entry.value;
  }

  clear() {
    this.map.clear();
  }

  *[Symbol.iterator]() {
    for (const list of this.map.values()) {
      for (const entry of list) {
        yield [entry.key, entry.value] as const;
      }
    }
  }
}
