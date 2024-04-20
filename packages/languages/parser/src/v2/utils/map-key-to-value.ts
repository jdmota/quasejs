import { equals, ObjectHashEquals } from "./index.ts";

type MapKey = ObjectHashEquals | null;

type MapEntry<K, V> = {
  key: K;
  value: V;
};

const TABLE_SIZE = 10;

export class MapKeyToValue<K extends MapKey, V> {
  private table: (MapEntry<K, V>[] | undefined)[];
  size: number;

  constructor() {
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

  get(key: K): V | null {
    const { entry } = this.entry(key);
    if (entry) {
      return entry.value;
    }
    return null;
  }

  add(key: K, value: V) {
    const { entry, list } = this.entry(key);
    if (entry) {
      if (entry.value === value) {
        return false;
      }
      throw new Error(`Already exists key:${key} value:${value}`);
    }
    list.push({
      key,
      value,
    });
    this.size++;
    return true;
  }

  set(key: K, value: V) {
    const { entry, list } = this.entry(key);
    if (entry) {
      const oldValue = entry.value;
      entry.value = value;
      return oldValue;
    }
    list.push({
      key,
      value,
    });
    this.size++;
    return null;
  }

  update(key: K, fn: (old: V | null) => V): V {
    const { entry, list } = this.entry(key);
    if (entry) {
      entry.value = fn(entry.value);
      return entry.value;
    }
    const value = fn(null);
    list.push({
      key,
      value,
    });
    this.size++;
    return value;
  }

  computeIfAbsent(key: K, fn: () => V): V {
    const { entry, list } = this.entry(key);
    if (entry) {
      return entry.value;
    }
    const value = fn();
    list.push({
      key,
      value,
    });
    this.size++;
    return value;
  }

  *[Symbol.iterator]() {
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

  *keys() {
    let idx = 0;
    let listIdx = 0;
    while (idx < this.table.length) {
      const list = this.table[idx];
      if (list) {
        while (listIdx < list.length) {
          yield list[listIdx].key;
          listIdx++;
        }
      }
      idx++;
      listIdx = 0;
    }
  }
}
