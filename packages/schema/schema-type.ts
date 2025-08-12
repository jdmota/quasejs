export abstract class SchemaDecorator {
  abstract getName(): string;
  abstract canCompile(kind: string): boolean;
  abstract compile(
    target: SchemaType,
    kind: string,
    ...args: readonly unknown[]
  ): unknown;
}

export class SchemaType {
  getName() {
    return "type";
  }

  alias(name: string) {
    return new SchemaAlias(this, name);
  }

  decorate(decorator: SchemaDecorator): SchemaWithDecorator {
    return new SchemaWithDecorator(this, decorator);
  }

  compile(kind: string, ...args: readonly unknown[]) {
    if (!kind) {
      throw new Error(`Empty kind string`);
    }

    const method = `compile${kind}`;
    const func = (this as any)[method];

    if (typeof func !== "function") {
      throw new Error(`Found no ${method} method`);
    }

    return func.call(this, ...args);
  }
}

export class SchemaAlias extends SchemaType {
  static build(target: SchemaType, name: string) {
    return new SchemaAlias(target, name);
  }

  readonly _tag = "SchemaAlias";

  constructor(
    readonly target: SchemaType,
    readonly name: string
  ) {
    super();
  }

  override getName() {
    return this.name;
  }
}

export class SchemaWithDecorator extends SchemaType {
  static build(target: SchemaType, decorator: SchemaDecorator) {
    return new SchemaWithDecorator(target, decorator);
  }

  readonly _tag = "SchemaWithDecorator";

  constructor(
    readonly target: SchemaType,
    readonly decorator: SchemaDecorator
  ) {
    super();
  }

  override getName() {
    return `${this.target.getName()}$${this.decorator.getName()}`;
  }

  override compile(kind: string, ...args: readonly unknown[]) {
    if (this.decorator.canCompile(kind)) {
      return this.decorator.compile(this, kind, ...args);
    }
    return super.compile(kind, ...args);
  }
}
