import { first, never } from "../../utils";
import { AnyType, isFreeType, TypesRegistry } from "./types";

abstract class NormalizedType {
  abstract toTypescript(): string;
}

class AliasType extends NormalizedType {
  readonly clazz = "AliasType";

  readonly id: string;
  constructor(id: string) {
    super();
    this.id = id;
  }

  toTypescript() {
    return this.id;
  }
}

class ReadonlyObjectType extends NormalizedType {
  readonly clazz = "ReadonlyObjectType";

  readonly fields: readonly (readonly [string, NormalizedType])[];
  constructor(fields: readonly (readonly [string, NormalizedType])[]) {
    super();
    this.fields = fields;
  }

  toTypescript(): string {
    return `{ ${this.fields
      .map(([k, v]) => `${k}: ${v.toTypescript()}`)
      .join(", ")} }`;
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
    return `readonly ${this.component.toTypescript()}[]`;
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
    return `${this.component.toTypescript()}[]`;
  }
}

class TopType extends NormalizedType {
  readonly clazz = "TopType";

  toTypescript(): string {
    return "unknown";
  }
}

class NullType extends NormalizedType {
  readonly clazz = "NullType";

  toTypescript(): string {
    return "null";
  }
}

class StringType extends NormalizedType {
  readonly clazz = "StringType";

  toTypescript(): string {
    return "string";
  }
}

class BooleanType extends NormalizedType {
  readonly clazz = "BooleanType";

  toTypescript(): string {
    return "boolean";
  }
}

class IntType extends NormalizedType {
  readonly clazz = "IntType";

  toTypescript(): string {
    return "number";
  }
}

class BottomType extends NormalizedType {
  readonly clazz = "BottomType";

  toTypescript(): string {
    return "never";
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
    return `(${Array.from(this.types)
      .map(t => t.toTypescript())
      .join(" | ")})`;
  }
}

export class Normalizer {
  private readonly registry: TypesRegistry;
  private readonly cache = new Map<AnyType, NormalizedType>();
  private readonly processing = new Set<AnyType>();

  constructor(registry: TypesRegistry) {
    this.registry = registry;
  }

  normalize(type: AnyType) {
    const inCache = this.cache.get(type);
    // If it was already normalized
    if (inCache) return inCache;
    // Not sure if it is possible in this setting, but avoid recursive types...
    if (this.processing.has(type)) this.normalize(this.registry.t.top);
    // Normalize the type...
    this.processing.add(type);
    const normalized = this._normalize(type);
    this.processing.delete(type);
    // Store the result in the cache...
    this.cache.set(type, normalized);
    return normalized;
  }

  private _normalize(type: AnyType): NormalizedType {
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
        const set = new Set<NormalizedType>();
        for (const sub of this.registry.getSubs(type)) {
          if (isFreeType(sub)) continue;
          set.add(this.normalize(sub));
        }
        return this.union(set);
      default:
        never(type);
    }
  }

  private union(set: ReadonlySet<NormalizedType>) {
    if (set.size === 0) {
      return this.normalize(this.registry.t.bottom);
    }
    if (set.size === 1) {
      return first(set);
    }
    return new UnionType(set);
  }
}
