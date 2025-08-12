import { setAdd } from "./maps-sets";

export class UniqueNames {
  private readonly used = new Set<string>();

  constructor(initialUsed: Iterable<string> = []) {
    for (const name of initialUsed) {
      this.used.add(name);
    }
  }

  mark(name: string) {
    return setAdd(this.used, name);
  }

  newInternal(name: string) {
    while (this.used.has(name)) {
      name = `_${name}`;
    }
    this.used.add(name);
    return name;
  }

  new(name: string) {
    let i = 0;
    while (this.used.has(name)) {
      name = `${name}${i}`;
      i++;
    }
    this.used.add(name);
    return name;
  }
}
