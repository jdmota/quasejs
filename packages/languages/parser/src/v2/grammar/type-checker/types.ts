import { never } from "../../utils";
import { AnyRule } from "../grammar-builder";
import { ConstraintsGraph } from "./constraints-graph";

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

  abstract setPolarity(polarity: TypePolarity, changed: Set<FreeType>): void;
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
  setPolarity(polarity: TypePolarity, changed: Set<FreeType>) {
    // TODO
    for (const [field, type] of this.fields) {
      type.setPolarity(polarity, changed);
    }
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
  setPolarity(polarity: TypePolarity, changed: Set<FreeType>) {
    // TODO
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
  setPolarity(polarity: TypePolarity, changed: Set<FreeType>) {
    // TODO
  }
}

abstract class AtomType extends Type {
  setPolarity(polarity: TypePolarity, changed: Set<FreeType>) {}
}

class TopType extends AtomType {
  readonly clazz = "TopType";
}

class NullType extends AtomType {
  readonly clazz = "NullType";
}

class StringType extends AtomType {
  readonly clazz = "StringType";
}

class BooleanType extends AtomType {
  readonly clazz = "BooleanType";
}

class IntType extends AtomType {
  readonly clazz = "IntType";
}

class BottomType extends AtomType {
  readonly clazz = "BottomType";
}

export function hasComponents(type: AnyType) {
  return (
    type.clazz === "ReadonlyArrayType" ||
    type.clazz === "ReadonlyObjectType" ||
    type.clazz === "ArrayType"
  );
}

export enum TypePolarity {
  NONE = 0, // 0b00
  GENERAL = 1, // 0b01
  SPECIFIC = 2, // 0b10
  BIPOLAR = 3, // 0b11
}

export function polarity(type: AnyType) {
  return isFreeType(type) ? type.polarity : null;
}

function isGeneral(type: FreeType) {
  return (type.polarity & TypePolarity.GENERAL) !== 0;
}

function isSpecific(type: FreeType) {
  return (type.polarity & TypePolarity.SPECIFIC) !== 0;
}

class FreeType extends Type {
  readonly clazz = "FreeType";

  constructor(public polarity: TypePolarity) {
    super();
  }

  setPolarity(polarity: TypePolarity, changed: Set<FreeType>) {
    const curr = this.polarity;
    // Even though TS does not check this, we know this is safe
    this.polarity |= polarity;
    if (curr !== this.polarity) {
      changed.add(this);
    }
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

  addManyToOne(keys: Iterable<K>, value: V) {
    for (const key of keys) {
      const set = this.get(key);
      set.add(value);
    }
  }

  addOneToMany(key: K, values: Iterable<V>) {
    const set = this.get(key);
    for (const val of values) {
      set.add(val);
    }
  }

  addManyToMany(keys: Iterable<K>, values: Iterable<V>) {
    for (const key of keys) {
      const set = this.get(key);
      for (const val of values) {
        set.add(val);
      }
    }
  }

  addManyToMany2(keys: Iterable<K>, values: Iterable<V>, newPairs: [K, V][]) {
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
  readonly graph = new ConstraintsGraph();

  private readonly allTypes = new Set<AnyType>();
  private readonly locations = new Map<AnyType, AnyRule>();
  private readonly supers = new MapSet<AnyType, AnyType>();
  private readonly subs = new MapSet<AnyType, AnyType>();

  private save<T extends AnyTypeExceptFree>(t: T, node: AnyRule): T {
    this.locations.set(t, node);
    //
    this.allTypes.add(t);
    this.supers.add(t, t);
    this.subs.add(t, t);
    return t;
  }

  private saveFree<T extends FreeType>(t: T): T {
    this.allTypes.add(t);
    this.supers.add(t, t);
    this.subs.add(t, t);
    return t;
  }

  subtype(a: AnyType, b: AnyType, node: AnyRule | null) {
    this.graph.edge(a, node, b);

    // Short-path
    if (this.supers.test(a, b)) return;

    // We register here the subtypying relationships
    // including those that can be obtained by transitivity
    const newPairs: [AnyType, AnyType][] = [];
    this.supers.addManyToMany2(this.subs.get(a), this.supers.get(b), newPairs);
    this.subs.addManyToMany(this.supers.get(b), this.subs.get(a));

    // Handle subtyping relationships of the components
    for (const [a, b] of newPairs) {
      handleSubtypingImplications(this, a, b, node);
    }
  }

  propagatePolarities() {
    // TODO propagate downwards the negative and upwards only the positive
    let changed = new Set<FreeType>();

    for (const [a, b] of this.supers) {
      if (isFreeType(a) && a.polarity !== TypePolarity.NONE && !isFreeType(b)) {
        b.setPolarity(a.polarity, changed);
      }
    }

    while (changed.size > 0) {
      const set = changed;
      changed = new Set();
      for (const a of set) {
        for (const b of this.supers.get(a)) {
          if (!isFreeType(b)) {
            b.setPolarity(a.polarity, changed);
          }
        }
      }
    }
  }

  // TODO maybe we should use singletons

  null(node: AnyRule) {
    return this.save(new NullType(), node);
  }

  string(node: AnyRule) {
    return this.save(new StringType(), node);
  }

  int(node: AnyRule) {
    return this.save(new IntType(), node);
  }

  boolean(node: AnyRule) {
    return this.save(new BooleanType(), node);
  }

  free(preference: TypePolarity = TypePolarity.NONE) {
    return this.saveFree(new FreeType(preference));
  }

  readonlyObject(fields: readonly string[], node: AnyRule) {
    return this.save(
      new ReadonlyObjectType(fields.map(f => [f, this.free()])),
      node
    );
  }

  readonlyArray(node: AnyRule) {
    return this.save(new ReadonlyArrayType(this.free()), node);
  }

  array(node: AnyRule) {
    return this.save(new ArrayType(this.free()), node);
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
