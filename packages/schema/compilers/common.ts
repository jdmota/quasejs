import type { SchemaType } from "../schema-type";

export class CircularCheck {
  private readonly set: WeakSet<SchemaType>;

  constructor() {
    this.set = new WeakSet();
  }

  check(node: SchemaType) {
    if (this.set.has(node)) {
      throw new Error(`Type refers itself`);
    }
  }

  add(node: SchemaType) {
    this.set.add(node);
  }

  remove(node: SchemaType) {
    this.set.delete(node);
  }
}
