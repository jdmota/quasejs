abstract class NormalizedType {
  abstract toTypescript(): string;
}

class ReadonlyObjectType extends NormalizedType {
  readonly clazz = "ReadonlyObjectType";

  readonly fields: ReadonlyMap<string, NormalizedType>;
  constructor(fields: readonly (readonly [string, NormalizedType])[]) {
    super();
    this.fields = new Map(fields);
  }

  toTypescript(): string {
    throw new Error("Method not implemented.");
  }
}

class ReadonlyArrayType extends NormalizedType {
  readonly clazz = "ReadonlyArrayType";

  readonly component: NormalizedType;
  constructor(component: NormalizedType) {
    super();
    this.component = component;
  }

  toTypescript(): string {
    throw new Error("Method not implemented.");
  }
}

class ArrayType extends NormalizedType {
  readonly clazz = "ArrayType";

  readonly component: NormalizedType;
  constructor(component: NormalizedType) {
    super();
    this.component = component;
  }

  toTypescript(): string {
    throw new Error("Method not implemented.");
  }
}

class TopType extends NormalizedType {
  readonly clazz = "TopType";

  toTypescript(): string {
    throw new Error("Method not implemented.");
  }
}

class NullType extends NormalizedType {
  readonly clazz = "NullType";

  toTypescript(): string {
    throw new Error("Method not implemented.");
  }
}

class StringType extends NormalizedType {
  readonly clazz = "StringType";

  toTypescript(): string {
    throw new Error("Method not implemented.");
  }
}

class BooleanType extends NormalizedType {
  readonly clazz = "BooleanType";

  toTypescript(): string {
    throw new Error("Method not implemented.");
  }
}

class IntType extends NormalizedType {
  readonly clazz = "IntType";

  toTypescript(): string {
    throw new Error("Method not implemented.");
  }
}

class BottomType extends NormalizedType {
  readonly clazz = "BottomType";

  toTypescript(): string {
    throw new Error("Method not implemented.");
  }
}

class UnionType extends NormalizedType {
  readonly clazz = "UnionType";

  readonly types: ReadonlySet<NormalizedType>;
  constructor(types: ReadonlySet<NormalizedType>) {
    super();
    this.types = types;
  }

  toTypescript(): string {
    throw new Error("Method not implemented.");
  }
}
