import { Location } from "../../runtime/input";
import { all, any, first, never } from "../../utils";
import { AnyRule } from "../grammar-builder";

// https://github.com/Microsoft/TypeScript/wiki/FAQ#why-do-these-empty-classes-behave-strangely

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
  readonly clazz = "TopType";
}

class NullType extends Type {
  readonly clazz = "NullType";
}

class StringType extends Type {
  readonly clazz = "StringType";
}

class BooleanType extends Type {
  readonly clazz = "BooleanType";
}

class IntType extends Type {
  readonly clazz = "IntType";
}

class BottomType extends Type {
  readonly clazz = "BottomType";
}

class IntersectionType extends Type {
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
  readonly clazz = "FreeType";
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

  *[Symbol.iterator]() {
    for (const [key, set] of this.map) {
      for (const value of set) {
        yield [key, value] as const;
      }
    }
  }
}

export function isFreeType(t: AnyType): t is FreeType {
  return t instanceof FreeType;
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

type AnyTypeExceptFree = Exclude<AnyType, FreeType>;

export type { FreeType };

export class TypesRegistry {
  private readonly allTypes = new Set<AnyType>();
  private readonly locations = new Map<AnyType, AnyRule>();
  private readonly toCheck: [AnyType, AnyTypeExceptFree, AnyRule][] = [];
  private readonly supers = new MapSet<AnyType, AnyType>();
  private readonly subs = new MapSet<AnyType, AnyType>();

  private save<T extends AnyTypeExceptFree>(t: T, node: AnyRule): T {
    this.allTypes.add(t);
    this.supers.add(t, t);
    this.subs.add(t, t);
    this.locations.set(t, node);
    return t;
  }

  private saveFree<T extends FreeType>(t: T): T {
    this.allTypes.add(t);
    this.supers.add(t, t);
    this.subs.add(t, t);
    return t;
  }

  subtype(a: AnyType, b: AnyType, node: AnyRule | null) {
    if (node != null && !isFreeType(b)) {
      this.toCheck.push([a, b, node]);
    }

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
      handleSubtypingImplications(this, a, b, node);
    }
  }

  getSupers(t: AnyType): ReadonlySet<AnyType> {
    return this.supers.get(t);
  }

  getSubs(t: AnyType): ReadonlySet<AnyType> {
    return this.subs.get(t);
  }

  *getUpperBound(t: FreeType): Iterable<AnyTypeExceptFree> {
    for (const sup of this.getSupers(t)) {
      if (sup instanceof FreeType) continue;
      yield sup;
    }
  }

  *getLowerBound(t: FreeType): Iterable<AnyTypeExceptFree> {
    for (const sub of this.getSubs(t)) {
      if (sub instanceof FreeType) continue;
      yield sub;
    }
  }

  null(node: AnyRule) {
    return this.save(new NullType(), node);
  }

  string(node: AnyRule) {
    return this.save(new StringType(), node);
  }

  int(node: AnyRule) {
    return this.save(new IntType(), node);
  }

  free() {
    return this.saveFree(new FreeType());
  }

  readonlyObject(
    fields: readonly (readonly [string, AnyType])[],
    node: AnyRule
  ) {
    return this.save(new ReadonlyObjectType(fields), node);
  }

  readonlyArray(component: AnyType, node: AnyRule) {
    return this.save(new ReadonlyArrayType(component), node);
  }

  array(component: AnyType, node: AnyRule) {
    return this.save(new ArrayType(component), node);
  }

  [Symbol.iterator]() {
    return this.allTypes.values();
  }

  *getChecks() {
    for (const [a, b] of this.supers) {
      if (a instanceof FreeType || b instanceof FreeType) continue;
      yield [a, b, this.locations.get(a), this.locations.get(b)] as const;
    }
  }
}

// TODO better errors (the location of errors)
// TODO always choose the lower bound except for atoms! but in that case, we should not include the transitive lower bound of atoms!
// TODO how to support generic types?
// TODO use type variable concept in arguments of the rules?

function handleSubtypingImplications(
  registry: TypesRegistry,
  a: AnyType,
  b: AnyType,
  node: AnyRule | null
) {
  if (a instanceof ReadonlyObjectType) {
    if (b instanceof ReadonlyObjectType) {
      for (const [key, typeB] of b.fields) {
        const typeA = a.fields.get(key);
        if (typeA != null) {
          registry.subtype(typeA, typeB, node);
        }
      }
    }
  } else if (a instanceof ReadonlyArrayType) {
    if (b instanceof ReadonlyArrayType) {
      registry.subtype(a.component, b.component, node);
    }
  } else if (a instanceof ArrayType) {
    if (b instanceof ArrayType) {
      registry.subtype(a.component, b.component, node);
    } else if (b instanceof ReadonlyArrayType) {
      registry.subtype(a.component, b.component, node);
    }
  }
}

function isSubtype2(
  registry: TypesRegistry,
  set: MapSet<AnyType, AnyType>,
  a: AnyType,
  b: AnyType
): boolean {
  if (set.test(a, b)) return true;
  set.add(a, b);

  // Short-path: Every type is a subtype of itself
  if (a === b) return true;

  // Every type is a subtype of TOP
  if (b instanceof TopType) return true;

  // BOTTOM is a subtype of any type
  if (a instanceof BottomType) return true;

  /*// For all...
  if (a instanceof FreeType) {
    return all(registry.getLowerBound(a), typeA =>
      isSubtype2(registry, set, typeA, b)
    );
    // FIXME this is wrong, maybe, it depends on how this type is initialized...
    // I mean, if we always choose the lower bound, I guess it is fine...
  }

  // For any...
  if (b instanceof FreeType) {
    return any(registry.getLowerBound(b), typeB =>
      isSubtype2(registry, set, a, typeB)
    );
  }*/

  if (a instanceof FreeType || b instanceof FreeType) {
    return true;
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
        if (typeA == null || !isSubtype2(registry, set, typeA, typeB)) {
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
      isSubtype2(registry, set, a.component, b.component)
    );
  }

  // Array<T1> type is a subtype of itself and ReadonlyArray<T2> if T1 <: T2
  if (a instanceof ArrayType) {
    return (
      (b instanceof ArrayType &&
        isSubtype2(registry, set, a.component, b.component) &&
        isSubtype2(registry, set, b.component, a.component)) ||
      (b instanceof ReadonlyArrayType &&
        isSubtype2(registry, set, a.component, b.component))
    );
  }

  never(a);
}

export function isSubtype(
  a: AnyType,
  b: AnyType,
  registry: TypesRegistry
): boolean {
  return isSubtype2(registry, new MapSet(), a, b);
}
