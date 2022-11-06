export class Path {
  public readonly parent: Path | null;
  public readonly key: string | null;

  constructor(parent: Path, key: string);
  constructor(parent: null, key: null);
  constructor(parent: Path | null, key: string | null) {
    this.parent = parent;
    this.key = key;
  }

  isRoot() {
    return this.parent == null;
  }

  push(key: string) {
    return new Path(this, key);
  }

  pop(): Path {
    if (this.parent == null)
      throw new Error("Invariant: validation path - cannot pop the root");
    return this.parent;
  }

  static create() {
    return new Path(null, null);
  }
}
