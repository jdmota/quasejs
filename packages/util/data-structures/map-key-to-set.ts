import { equals, ObjectHashEquals } from "../miscellaneous";

export interface ReadonlySpecialSet<T> {
  [Symbol.iterator](): Iterator<T>;
}

export interface SpecialSet<T> extends ReadonlySpecialSet<T> {
  add(value: T): void;
}

export type MapKey = ObjectHashEquals | null;

export type MapEntry<K, V> = {
  key: K;
  value: V;
};

const TABLE_SIZE = 1000;

type NewSetFn<K, V, S extends SpecialSet<V>> = (key: K) => S;

export class MapKeyToSpecialSet<K extends MapKey, V, S extends SpecialSet<V>> {
  private table: (MapEntry<K, S>[] | undefined)[];
  size: number;

  constructor(readonly newSet: NewSetFn<K, V, S>) {
    this.table = [];
    this.size = 0;
  }

  private entry(key: K) {
    const idx = key === null ? 0 : Math.abs(key.hashCode() % TABLE_SIZE);
    let list = this.table[idx];
    if (!list) {
      list = this.table[idx] = [];
    }
    return {
      entry: list.find(entry => equals(entry.key, key)),
      list,
    };
  }

  get(key: K) {
    const { entry } = this.entry(key);
    if (entry) {
      return entry.value;
    }
    return this.newSet(key);
  }

  add(key: K, value: Iterable<V>) {
    const { entry, list } = this.entry(key);
    if (entry) {
      for (const v of value) {
        entry.value.add(v);
      }
    } else {
      const set = this.newSet(key);
      for (const v of value) {
        set.add(v);
      }
      list.push({
        key,
        value: set,
      });
      this.size++;
    }
  }

  addOne(key: K, value: V) {
    const { entry, list } = this.entry(key);
    if (entry) {
      entry.value.add(value);
    } else {
      const set = this.newSet(key);
      set.add(value);
      list.push({
        key,
        value: set,
      });
      this.size++;
    }
  }

  *[Symbol.iterator](): IterableIterator<readonly [K, Omit<S, "add">]> {
    let idx = 0;
    let listIdx = 0;
    while (idx < this.table.length) {
      const list = this.table[idx];
      if (list) {
        while (listIdx < list.length) {
          const { key, value } = list[listIdx];
          yield [key, value] as const;
          listIdx++;
        }
      }
      idx++;
      listIdx = 0;
    }
  }
}

export class MapKeyToSet<K extends MapKey, V> extends MapKeyToSpecialSet<
  K,
  V,
  Set<V>
> {
  constructor() {
    super(() => new Set());
  }
}
