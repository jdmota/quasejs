export class Path {
  public readonly parent: Path | null;
  public readonly key: string | number | null;
  public readonly inKey: boolean;

  constructor(parent: Path, key: string | number, inKey: boolean);
  constructor(parent: null, key: null, inKey: false);
  constructor(
    parent: Path | null,
    key: string | number | null,
    inKey: boolean
  ) {
    this.parent = parent;
    this.key = key;
    this.inKey = inKey;
  }

  isRoot() {
    return this.parent == null;
  }

  push(key: string | number, inKey = false) {
    return new Path(this, key, inKey);
  }

  pop(): Path {
    if (this.parent == null)
      throw new Error("Invariant: validation path - cannot pop the root");
    return this.parent;
  }

  static create() {
    return new Path(null, null, false);
  }
}
