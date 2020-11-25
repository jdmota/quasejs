type MapKey = {
  hashCode(): number;
  equals(other: unknown): boolean;
};

type MapEntry<K, V> = {
  key: K;
  value: V;
};

const TABLE_SIZE = 10;

export class MapKeyToValue<K extends MapKey, V> {
  table: (MapEntry<K, V>[] | undefined)[];
  size: number;

  constructor() {
    this.table = [];
    this.size = 0;
  }

  _entry(key: K) {
    const idx = Math.abs(key.hashCode() % TABLE_SIZE);
    let list = this.table[idx];
    if (!list) {
      list = this.table[idx] = [];
    }
    return {
      entry: list.find(entry => entry.key.equals(key)),
      list,
    };
  }

  get(key: K): V | null {
    const { entry } = this._entry(key);
    if (entry) {
      return entry.value;
    }
    return null;
  }

  add(key: K, value: V) {
    const { entry, list } = this._entry(key);
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
}
