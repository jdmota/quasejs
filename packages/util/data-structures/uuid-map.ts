export class UUIDMap {
  private readonly map: Map<string, number>;

  constructor() {
    this.map = new Map();
  }

  makeUnique(key: string) {
    const id = this.map.get(key) ?? 1;
    const first = id === 1;
    this.map.set(key, id + 1);
    return { id: key + "$" + id, first };
  }
}
