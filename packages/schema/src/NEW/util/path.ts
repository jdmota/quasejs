export class Path {
  public readonly parent: Path | null;
  public readonly key: string | number | null;
  public readonly context: string | null;

  constructor(
    parent: Path,
    key: string | number | null,
    context: string | null
  );
  constructor(parent: null, key: null, context: null);
  constructor(
    parent: Path | null,
    key: string | number | null,
    context: string | null
  ) {
    this.parent = parent;
    this.key = key;
    this.context = context;
  }

  isRoot() {
    return this.parent == null;
  }

  push(key: string | number | null, context: string | null = null) {
    return new Path(this, key, context);
  }

  pop(): Path {
    if (this.parent == null)
      throw new Error("Invariant: validation path - cannot pop the root");
    return this.parent;
  }

  static create() {
    return new Path(null, null, null);
  }
}
