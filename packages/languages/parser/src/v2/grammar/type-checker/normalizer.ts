import { assertion, first, never, nonNull } from "../../utils";
import { AnyType, isFreeType, TypesRegistry } from "./types";

abstract class NormalizedType {
  abstract format(): string;
}

class RecursiveRef extends NormalizedType {
  readonly clazz = "RecursiveRef";

  private type: AnyNormalizedType | null = null;

  ensure(type: AnyNormalizedType) {
    this.type = type;
  }

  get() {
    return nonNull(this.type);
  }

  format() {
    return `recursive`;
  }
}

class ReadonlyObjectType extends NormalizedType {
  readonly clazz = "ReadonlyObjectType";

  readonly fields: readonly (readonly [string, AnyNormalizedType])[];
  constructor(fields: readonly (readonly [string, AnyNormalizedType])[]) {
    super();
    this.fields = fields;
  }

  format(): string {
    return `{ ${this.fields
      .map(([k, v]) => `${k}: ${v.format()}`)
      .join(", ")} }`;
  }
}

class ReadonlyArrayType extends NormalizedType {
  readonly clazz = "ReadonlyArrayType";

  readonly component: AnyNormalizedType;
  constructor(component: AnyNormalizedType) {
    super();
    this.component = component;
  }

  format(): string {
    return `readonly ${this.component.format()}[]`;
  }
}

class ArrayType extends NormalizedType {
  readonly clazz = "ArrayType";

  readonly component: AnyNormalizedType;
  constructor(component: AnyNormalizedType) {
    super();
    this.component = component;
  }

  format(): string {
    return `${this.component.format()}[]`;
  }
}

class TopType extends NormalizedType {
  readonly clazz = "TopType";

  format(): string {
    return "unknown";
  }
}

class NullType extends NormalizedType {
  readonly clazz = "NullType";

  format(): string {
    return "null";
  }
}

class StringType extends NormalizedType {
  readonly clazz = "StringType";

  format(): string {
    return "string";
  }
}

class BooleanType extends NormalizedType {
  readonly clazz = "BooleanType";

  format(): string {
    return "boolean";
  }
}

class IntType extends NormalizedType {
  readonly clazz = "IntType";

  format(): string {
    return "number";
  }
}

class BottomType extends NormalizedType {
  readonly clazz = "BottomType";

  format(): string {
    return "never";
  }
}

class UnionType extends NormalizedType {
  readonly clazz = "UnionType";

  readonly types: ReadonlySet<AnyNormalizedType>;
  constructor(types: ReadonlySet<AnyNormalizedType>) {
    super();
    this.types = types;
  }

  format(): string {
    return `(${Array.from(this.types)
      .map(t => t.format())
      .join(" | ")})`;
  }
}

export type AnyNormalizedType =
  | RecursiveRef
  | ReadonlyObjectType
  | ReadonlyArrayType
  | ArrayType
  | TopType
  | StringType
  | IntType
  | BooleanType
  | NullType
  | BottomType
  | UnionType;

export class Normalizer {
  private readonly registry: TypesRegistry;
  private readonly cache = new Map<AnyType, AnyNormalizedType>();
  private readonly processing = new Map<AnyType, RecursiveRef>();
  private readonly usedRecursiveRefs = new Set<RecursiveRef>();

  constructor(registry: TypesRegistry) {
    this.registry = registry;
  }

  getUsedRecursiveRefs(): ReadonlySet<RecursiveRef> {
    return this.usedRecursiveRefs;
  }

  normalize(type: AnyType) {
    const cached = this.cache.get(type);
    // If it was already normalized...
    if (cached) return cached;
    // Avoid infinite recursion...
    let rec = this.processing.get(type);
    if (rec) {
      this.usedRecursiveRefs.add(rec);
      return rec;
    }
    rec = new RecursiveRef();
    this.processing.set(type, rec);
    // Normalize the type...
    const normalized = this._normalize(type);
    // Store the results...
    rec.ensure(normalized);
    this.processing.delete(type);
    this.cache.set(type, normalized);
    return normalized;
  }

  private _normalize(type: AnyType): AnyNormalizedType {
    switch (type.clazz) {
      case "TopType":
        return new TopType();
      case "StringType":
        return new StringType();
      case "IntType":
        return new IntType();
      case "NullType":
        return new NullType();
      case "BooleanType":
        return new BooleanType();
      case "BottomType":
        return new BottomType();
      case "ReadonlyObjectType":
        return new ReadonlyObjectType(
          Array.from(type.fields).map(([k, v]) => [k, this.normalize(v)])
        );
      case "ReadonlyArrayType":
        return new ReadonlyArrayType(this.normalize(type.component));
      case "ArrayType":
        return new ArrayType(this.normalize(type.component));
      case "FreeType":
        const set = new Set<AnyNormalizedType>();
        for (const sub of this.registry.getSubs(type)) {
          if (isFreeType(sub)) continue;
          set.add(this.normalize(sub));
        }
        return this.union(set);
      default:
        never(type);
    }
  }

  private union(set: ReadonlySet<AnyNormalizedType>) {
    if (set.size === 0) {
      return new BottomType();
    }
    if (set.size === 1) {
      return first(set);
    }
    return new UnionType(set);
  }
}
