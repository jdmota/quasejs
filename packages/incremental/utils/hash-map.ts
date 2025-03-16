import { LinkedList } from "../../util/data-structures/linked-list";

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

export type MapEvent<K, V> =
  | {
      readonly type: "added";
      readonly key: K;
      readonly value: V;
      readonly oldValue: undefined;
    }
  | {
      readonly type: "changed";
      readonly key: K;
      readonly value: V;
      readonly oldValue: V;
    }
  | {
      readonly type: "removed";
      readonly key: K;
      readonly value: undefined;
      readonly oldValue: V;
    };

const DIFF = {
  added: 1,
  changed: 0,
  removed: -1,
} as const;

const falseFn = () => false;

export class HashMap<K, V> implements ReadonlyHashMap<K, V> {
  private readonly map: Map<number, LinkedList<HashMapEntry<K, V>>>;
  private readonly hash: (key: K) => number;
  private readonly equal: (a: K, b: K) => boolean;
  private sizeCount: number;
  private snapshot: ReadonlySnapshotHashMap<K, V> | null;

  constructor(valueDef: ValueDefinition<K>) {
    this.map = new Map();
    this.hash = valueDef.hash;
    this.equal = valueDef.equal;
    this.sizeCount = 0;
    this.snapshot = null;
  }

  clear() {
    this.map.clear();
    this.sizeCount = 0;
    if (this.snapshot) {
      this.snapshot.map = null;
      this.snapshot = null;
    }
  }

  getSnapshot(): ReadonlySnapshotHashMap<K, V> {
    if (!this.snapshot) {
      this.snapshot = new ReadonlySnapshotHashMap(this);
    }
    return this.snapshot;
  }

  protected changed(event: MapEvent<K, V>) {
    this.sizeCount += DIFF[event.type];
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

    this.changed({
      type: "removed",
      key: entry.key,
      value: undefined,
      oldValue: entry.value,
    });
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
      this.changed({
        type: "added",
        key,
        value,
        oldValue: undefined,
      });
    } else {
      const oldValue = entry.value;
      if (equal(oldValue, value)) {
        return;
      }
      entry.value = value;
      this.changed({
        type: "changed",
        key,
        value,
        oldValue,
      });
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
      this.changed({
        type: "added",
        key,
        value: entry.value,
        oldValue: undefined,
      });
    }
    return entry.value;
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

export type { ReadonlySnapshotHashMap };
