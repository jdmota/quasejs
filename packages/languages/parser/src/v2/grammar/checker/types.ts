import { all, any, first, never } from "../../utils";

abstract class Type {
  formatMeta(seen: Set<Type>): string {
    return "";
  }
  format(seen: Set<Type>): string {
    if (seen.has(this)) return "circular";
    seen.add(this);
    return `${this.constructor.name} {${[
      this.formatMeta(seen),
      /*this.supertypes.size > 0
        ? `supers: ${Array.from(this.supertypes)
            .map(t => t.format(seen))
            .join(", ")}`
        : "",*/
    ]
      .filter(Boolean)
      .join(", ")}}`;
  }
  simpleFormat(): string {
    return `${this.constructor.name} {${this.formatMeta(new Set())}}`;
  }
  toString() {
    return this.format(new Set());
  }
}

class ReadonlyObjectType extends Type {
  // https://github.com/Microsoft/TypeScript/wiki/FAQ#why-do-these-empty-classes-behave-strangely
  readonly clazz = "ReadonlyObjectType";

  readonly fields: ReadonlyMap<string, AnyType>;
  constructor(fields: readonly (readonly [string, AnyType])[]) {
    super();
    this.fields = new Map(fields);
  }
  formatMeta(seen: Set<Type>) {
    return Array.from(this.fields)
      .map(([k, v]) => `${k}: ${v.format(seen)}`)
      .join(", ");
  }
}

class ReadonlyArrayType extends Type {
  // https://github.com/Microsoft/TypeScript/wiki/FAQ#why-do-these-empty-classes-behave-strangely
  readonly clazz = "ReadonlyArrayType";

  readonly component: AnyType;
  constructor(component: AnyType) {
    super();
    this.component = component;
  }
  formatMeta(seen: Set<Type>) {
    return `component: ${this.component.format(seen)}`;
  }
}

class ArrayType extends Type {
  // https://github.com/Microsoft/TypeScript/wiki/FAQ#why-do-these-empty-classes-behave-strangely
  readonly clazz = "ArrayType";

  readonly component: AnyType;
  constructor(component: AnyType) {
    super();
    this.component = component;
  }
  formatMeta(seen: Set<Type>) {
    return `component: ${this.component.format(seen)}`;
  }
}

class TopType extends Type {
  // https://github.com/Microsoft/TypeScript/wiki/FAQ#why-do-these-empty-classes-behave-strangely
  readonly clazz = "TopType";
}

class NullType extends Type {
  // https://github.com/Microsoft/TypeScript/wiki/FAQ#why-do-these-empty-classes-behave-strangely
  readonly clazz = "NullType";
}

class StringType extends Type {
  // https://github.com/Microsoft/TypeScript/wiki/FAQ#why-do-these-empty-classes-behave-strangely
  readonly clazz = "StringType";
}

class BooleanType extends Type {
  // https://github.com/Microsoft/TypeScript/wiki/FAQ#why-do-these-empty-classes-behave-strangely
  readonly clazz = "BooleanType";
}

class IntType extends Type {
  // https://github.com/Microsoft/TypeScript/wiki/FAQ#why-do-these-empty-classes-behave-strangely
  readonly clazz = "IntType";
}

class BottomType extends Type {
  // https://github.com/Microsoft/TypeScript/wiki/FAQ#why-do-these-empty-classes-behave-strangely
  readonly clazz = "BottomType";
}

class IntersectionType extends Type {
  // https://github.com/Microsoft/TypeScript/wiki/FAQ#why-do-these-empty-classes-behave-strangely
  readonly clazz = "IntersectionType";

  readonly types: ReadonlySet<Type>;
  constructor(types: ReadonlySet<Type>) {
    super();
    this.types = types;
  }
  formatMeta(seen: Set<Type>) {
    return Array.from(this.types)
      .map(t => t.format(seen))
      .join(" & ");
  }
}

class UnionType extends Type {
  // https://github.com/Microsoft/TypeScript/wiki/FAQ#why-do-these-empty-classes-behave-strangely
  readonly clazz = "UnionType";

  readonly types: ReadonlySet<Type>;
  constructor(types: ReadonlySet<Type>) {
    super();
    this.types = types;
  }
  formatMeta(seen: Set<Type>) {
    return Array.from(this.types)
      .map(t => t.format(seen))
      .join(" | ");
  }
}

class FreeType extends Type {
  // https://github.com/Microsoft/TypeScript/wiki/FAQ#why-do-these-empty-classes-behave-strangely
  readonly clazz = "FreeType";
}

class DefaultMap<K, V> extends Map<K, V> {
  private readonly fn: (key: K) => V;
  constructor(fn: (key: K) => V) {
    super();
    this.fn = fn;
  }

  get(key: K): V {
    let val = super.get(key);
    if (val == null) {
      val = this.fn(key);
      this.set(key, val);
    }
    return val;
  }
}

class MapSet<K, V> {
  private readonly map = new Map<K, Set<V>>();

  get(key: K): Set<V> {
    let val = this.map.get(key);
    if (val == null) {
      val = new Set();
      this.map.set(key, val);
    }
    return val;
  }

  test(key: K, val: V) {
    return this.get(key).has(val);
  }

  add(key: K, val: V) {
    this.get(key).add(val);
  }

  addManyToMany(keys: Iterable<K>, values: Iterable<V>) {
    const newPairs = [];
    for (const key of keys) {
      const set = this.get(key);
      for (const val of values) {
        const oldSize = set.size;
        set.add(val);
        if (set.size > oldSize) {
          newPairs.push([key, val]);
        }
      }
    }
    return newPairs;
  }
}

export function isFreeType(t: AnyType): t is FreeType {
  return t instanceof FreeType;
}

export class TypesRegistry {
  private readonly allTypes = new Set<AnyType>();
  private readonly supers = new MapSet<AnyType, AnyType>();
  private readonly subs = new MapSet<AnyType, AnyType>();
  readonly t = {
    top: new TopType(),
    null: new NullType(),
    string: new StringType(),
    boolean: new BooleanType(),
    int: new IntType(),
    bottom: new BottomType(),
  };

  private save<T extends AnyType>(t: T): T {
    this.allTypes.add(t);
    this.supers.add(t, t);
    this.subs.add(t, t);
    return t;
  }

  constructor() {
    for (const t of Object.values(this.t)) {
      this.save(t);
    }
  }

  subtype(a: AnyType, b: AnyType) {
    // Short-path
    if (this.supers.test(a, b)) return;

    // We register here the subtypying relationships
    // including those that can be obtained by transitivity
    const newPairs = this.supers.addManyToMany(
      this.subs.get(a),
      this.supers.get(b)
    );
    this.subs.addManyToMany(this.supers.get(b), this.subs.get(a));

    // Handle subtyping relationships of the components
    for (const [a, b] of newPairs) {
      handleSubtypingImplications(a, b, this);
    }
  }

  getSupers(t: AnyType): ReadonlySet<AnyType> {
    return this.supers.get(t);
  }

  getSubs(t: AnyType): ReadonlySet<AnyType> {
    return this.subs.get(t);
  }

  *getNormalized(t: AnyType): Iterable<AnyType> {
    switch (t.clazz) {
      case "TopType":
      case "StringType":
      case "IntType":
      case "NullType":
      case "BooleanType":
      case "BottomType":
        yield t;
        break;
      case "ReadonlyObjectType":
        yield new ReadonlyObjectType(
          Array.from(t.fields).map(([k, v]) => [
            k,
            first(this.getNormalized(v), this.t.bottom),
          ])
        ); // TODO
        break;
      case "ReadonlyArrayType":
        yield new ReadonlyArrayType(
          first(this.getNormalized(t.component), this.t.bottom)
        ); // TODO
        break;
      case "ArrayType":
        yield new ArrayType(
          first(this.getNormalized(t.component), this.t.bottom)
        ); // TODO
        break;
      case "FreeType":
        let hasElements = false;
        for (const sub of this.getSubs(t)) {
          if (sub instanceof FreeType) continue;
          for (const normalized of this.getNormalized(sub)) {
            yield normalized;
            hasElements = true;
          }
        }
        if (!hasElements) yield this.t.bottom;
        break;
      default:
        never(t);
    }
  }

  free() {
    return this.save(new FreeType());
  }

  readonlyObject(fields: readonly (readonly [string, AnyType])[]) {
    return this.save(new ReadonlyObjectType(fields));
  }

  readonlyArray(component: AnyType) {
    return this.save(new ReadonlyArrayType(component));
  }

  array(component: AnyType) {
    return this.save(new ArrayType(component));
  }

  [Symbol.iterator]() {
    return this.allTypes.values();
  }
}

export type AnyType =
  | ReadonlyObjectType
  | ReadonlyArrayType
  | ArrayType
  | TopType
  | NullType
  | StringType
  | BooleanType
  | IntType
  | BottomType
  | FreeType;

export type { FreeType };

function handleSubtypingImplications(
  a: AnyType,
  b: AnyType,
  registry: TypesRegistry
) {
  if (a instanceof ReadonlyObjectType) {
    if (b instanceof ReadonlyObjectType) {
      for (const [key, typeB] of b.fields) {
        const typeA = a.fields.get(key);
        if (typeA != null) {
          registry.subtype(typeA, typeB);
        }
      }
    }
  } else if (a instanceof ReadonlyArrayType) {
    if (b instanceof ReadonlyArrayType) {
      registry.subtype(a.component, b.component);
    }
  } else if (a instanceof ArrayType) {
    if (b instanceof ArrayType) {
      registry.subtype(a.component, b.component);
    } else if (b instanceof ReadonlyArrayType) {
      registry.subtype(a.component, b.component);
    }
  }
}

export function isSubtype(
  a: AnyType,
  b: AnyType,
  registry: TypesRegistry
): boolean {
  // Short-path: Every type is a subtype of itself
  if (a === b) return true;

  // Every type is a subtype of TOP
  if (b instanceof TopType) return true;

  // BOTTOM is a subtype of any type
  if (a instanceof BottomType) return true;

  // For all...
  if (a instanceof FreeType) {
    return all(registry.getNormalized(a), typeA =>
      isSubtype(typeA, b, registry)
    );
  }

  // For any...
  if (b instanceof FreeType) {
    return any(registry.getNormalized(b), typeB =>
      isSubtype(a, typeB, registry)
    );
  }

  // TOP is only a subtype of TOP
  if (a instanceof TopType) return false;

  // Atom types are subtypes of themselves and TOP
  if (a instanceof NullType) return b instanceof NullType;
  if (a instanceof StringType) return b instanceof StringType;
  if (a instanceof BooleanType) return b instanceof BooleanType;
  if (a instanceof IntType) return b instanceof IntType;

  // A ReadonlyObjectType is a subtype of another if all the keys in the second are in the first
  // and (for the common keys) the types in the first are subtypes of the ones in the second
  if (a instanceof ReadonlyObjectType) {
    if (b instanceof ReadonlyObjectType) {
      for (const [key, typeB] of b.fields) {
        const typeA = a.fields.get(key);
        if (typeA == null || !isSubtype(typeA, typeB, registry)) {
          return false;
        }
      }
      return true;
    }
    return false;
  }

  // ReadonlyArray<T1> <: ReadonlyArray<T2> if T1 <: T2
  if (a instanceof ReadonlyArrayType) {
    return (
      b instanceof ReadonlyArrayType &&
      isSubtype(a.component, b.component, registry)
    );
  }

  // Array<T1> type is a subtype of itself and ReadonlyArray<T2> if T1 <: T2
  if (a instanceof ArrayType) {
    return (
      (b instanceof ArrayType &&
        isSubtype(a.component, b.component, registry) &&
        isSubtype(b.component, a.component, registry)) ||
      (b instanceof ReadonlyArrayType &&
        isSubtype(a.component, b.component, registry))
    );
  }

  never(a);
}

export function areSubtypesOfAll(
  subs: ReadonlySet<AnyType>,
  supers: ReadonlySet<AnyType>
) {}
