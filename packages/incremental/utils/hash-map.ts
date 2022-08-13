import { LinkedList } from "./linked-list";

export type ValueDefinition<T> = {
  readonly equal: (a: T, b: T) => boolean;
  readonly hash: (a: T) => number;
};

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
  private snapshot: ReadonlySnapshotHashMap<K, V> | null;

  constructor(valueDef: ValueDefinition<K>) {
    this.map = new Map();
    this.hash = valueDef.hash;
    this.equal = valueDef.equal;
    this.snapshot = null;
  }

  getSnapshot(): ReadonlySnapshotHashMap<K, V> {
    if (!this.snapshot) {
      this.snapshot = new ReadonlySnapshotHashMap(this);
    }
    return this.snapshot;
  }

  private changed() {
    if (this.snapshot) {
      this.snapshot.map = null;
      this.snapshot = null;
    }
  }

  get(key: K): V | undefined {
    return this.map
      .get(this.hash(key))
      ?.find(entry => this.equal(entry.key, key))?.value;
  }

  delete(key: K): V | undefined {
    this.changed();

    return this.map
      .get(this.hash(key))
      ?.remove(entry => this.equal(entry.key, key))?.value;
  }

  set(key: K, value: V) {
    this.changed();

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
    this.changed();

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
    this.changed();
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

class ReadonlySnapshotHashMap<K, V> implements ReadonlyHashMap<K, V> {
  public map: ReadonlyHashMap<K, V> | null;

  constructor(map: ReadonlyHashMap<K, V>) {
    this.map = map;
  }

  didChange() {
    return this.map == null;
  }

  private getMap() {
    if (this.map) return this.map;
    throw new Error("The underlying map has changed");
  }

  get(key: K): V | undefined {
    return this.getMap().get(key);
  }

  [Symbol.iterator](): IterableIterator<readonly [K, V]> {
    return this.getMap()[Symbol.iterator]();
  }
}

export type { ReadonlySnapshotHashMap as ReadonlyHandlerHashMap };
