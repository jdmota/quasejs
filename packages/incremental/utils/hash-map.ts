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
  size(): number;
  get(key: K): V | undefined;
  [Symbol.iterator](): IterableIterator<readonly [K, V]>;
}

const falseFn = () => false;

export class HashMap<K, V> implements ReadonlyHashMap<K, V> {
  private readonly map: Map<number, LinkedList<HashMapEntry<K, V>>>;
  private readonly hash: (key: K) => number;
  private readonly equal: (a: K, b: K) => boolean;
  private snapshot: ReadonlySnapshotHashMap<K, V> | null;
  private sizeCount: number;

  constructor(valueDef: ValueDefinition<K>) {
    this.map = new Map();
    this.hash = valueDef.hash;
    this.equal = valueDef.equal;
    this.snapshot = null;
    this.sizeCount = 0;
  }

  getSnapshot(): ReadonlySnapshotHashMap<K, V> {
    if (!this.snapshot) {
      this.snapshot = new ReadonlySnapshotHashMap(this);
    }
    return this.snapshot;
  }

  private changed(diff: number) {
    this.sizeCount += diff;
    if (this.snapshot) {
      this.snapshot.map = null;
      this.snapshot = null;
    }
  }

  size() {
    return this.sizeCount;
  }

  get(key: K): V | undefined {
    return this.map
      .get(this.hash(key))
      ?.find(entry => this.equal(entry.key, key))?.value;
  }

  delete(key: K): V | undefined {
    const hash = this.hash(key);

    const list = this.map.get(hash);
    if (list === undefined) {
      return;
    }

    const entry = list.remove(entry => this.equal(entry.key, key));
    if (entry === undefined) {
      return;
    }

    this.changed(-1);
    return entry.value;
  }

  set(key: K, value: V, equal: (a: V, b: V) => boolean = falseFn) {
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
      this.changed(1);
    } else {
      const oldValue = entry.value;
      entry.value = value;
      if (!equal(oldValue, value)) this.changed(0);
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
      this.changed(1);
    }
    return entry.value;
  }

  clear() {
    this.changed(-this.sizeCount);
    this.map.clear();
  }

  *values() {
    for (const list of this.map.values()) {
      for (const entry of list) {
        yield entry.value;
      }
    }
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

  size() {
    return this.getMap().size();
  }

  [Symbol.iterator](): IterableIterator<readonly [K, V]> {
    return this.getMap()[Symbol.iterator]();
  }
}

export type { ReadonlySnapshotHashMap as ReadonlyHandlerHashMap };
