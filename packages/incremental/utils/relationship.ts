import { getSet } from "./maps-sets";

export class OneToMany<O, M> {
  private readonly oneToMany: Map<O, Set<M>>;
  private readonly manyToOne: Map<M, O>;

  constructor() {
    this.oneToMany = new Map();
    this.manyToOne = new Map();
  }

  add(one: O, other: M) {
    if (this.manyToOne.has(other)) {
      throw new Error("already related");
    }
    this.manyToOne.set(other, one);
    getSet(this.oneToMany, one).add(other);
  }

  has(one: O, other: M) {
    return this.manyToOne.get(other) === one;
  }

  getMany(one: O) {
    return getSet(this.oneToMany, one);
  }

  getOne(other: M) {
    return this.manyToOne.get(other);
  }

  [Symbol.iterator]() {
    return this.oneToMany.entries();
  }

  keys() {
    return this.oneToMany.keys();
  }
}
