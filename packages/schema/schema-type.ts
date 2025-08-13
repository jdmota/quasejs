export abstract class SchemaDecorator<
  Target extends SchemaType,
  Out extends SchemaType,
> {
  abstract getName(): string;
  abstract build(target: Target): Out;
}

export class SchemaType {
  constructor(readonly metadata?: unknown) {}

  getName() {
    return "type";
  }

  alias(name: string) {
    return new SchemaAlias(this, name);
  }

  decorate<T extends SchemaType>(decorator: SchemaDecorator<this, T>) {
    return decorator.build(this);
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
