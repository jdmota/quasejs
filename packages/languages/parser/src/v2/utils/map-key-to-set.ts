type MapKey = {
  hashCode(): number;
  equals(other: unknown): boolean;
};

type MapEntry<K, V> = {
  key: K;
  value: V;
};

const TABLE_SIZE = 10;

export class MapKeyToSet<K extends MapKey, V> {
  private table: (MapEntry<K, Set<V>>[] | undefined)[];
  private EMPTY_SET: Set<V>;
  size: number;

  constructor() {
    this.table = [];
    this.size = 0;
    this.EMPTY_SET = new Set();
  }

  private entry(key: K) {
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

  get(key: K): Set<V> {
    const { entry } = this.entry(key);
    if (entry) {
      return entry.value;
    }
    return this.EMPTY_SET;
  }

  add(key: K, value: ReadonlySet<V>) {
    const { entry, list } = this.entry(key);
    if (entry) {
      for (const v of value) {
        entry.value.add(v);
      }
    } else {
      list.push({
        key,
        value: new Set(value),
      });
      this.size++;
    }
  }

  addOne(key: K, value: V) {
    const { entry, list } = this.entry(key);
    if (entry) {
      entry.value.add(value);
    } else {
      list.push({
        key,
        value: new Set([value]),
      });
      this.size++;
    }
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
