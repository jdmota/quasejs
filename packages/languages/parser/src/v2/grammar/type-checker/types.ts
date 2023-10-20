import { never } from "../../utils";
import { AnyRule } from "../grammar-builder";
import { ConstraintsGraph } from "./constraints-graph";

// https://github.com/Microsoft/TypeScript/wiki/FAQ#why-do-these-empty-classes-behave-strangely

const EMPTY_FREE_TYPE_ARRAY: readonly FreeType[] = [];

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
  setPolarity(polarity: TypePolarity, changed: Set<FreeType>) {
    // Do nothing here
  }
}

abstract class ConstructedType extends Type {
  abstract positiveTypes(): readonly AnyType[];
  abstract negativeTypes(): readonly AnyType[];
}

class FunctionType extends ConstructedType {
  readonly clazz = "FunctionType";

  constructor(readonly args: readonly AnyType[], readonly ret: AnyType) {
    super();
  }

  positiveTypes(): readonly AnyType[] {
    return [this.ret];
  }
  negativeTypes(): readonly AnyType[] {
    return this.args;
  }
}

class ReadonlyObjectType extends ConstructedType {
  readonly clazz = "ReadonlyObjectType";

  readonly fields: ReadonlyMap<string, AnyType>;
  constructor(fields: readonly (readonly [string, AnyType])[]) {
    super();
    this.fields = new Map(fields);
  }
  override formatMeta(seen: Set<Type>) {
    return Array.from(this.fields)
      .map(([k, v]) => `${k}: ${v.format(seen)}`)
      .join(", ");
  }
  positiveTypes(): readonly AnyType[] {
    return Array.from(this.fields.values());
  }
  negativeTypes(): readonly AnyType[] {
    return EMPTY_FREE_TYPE_ARRAY;
  }
}

class ReadonlyArrayType extends ConstructedType {
  readonly clazz = "ReadonlyArrayType";

  readonly component: AnyType;
  constructor(component: AnyType) {
    super();
    this.component = component;
  }
  override formatMeta(seen: Set<Type>) {
    return `component: ${this.component.format(seen)}`;
  }
  positiveTypes(): readonly AnyType[] {
    return [this.component];
  }
  negativeTypes(): readonly AnyType[] {
    return EMPTY_FREE_TYPE_ARRAY;
  }
}

class ArrayType extends ConstructedType {
  readonly clazz = "ArrayType";

  readonly component: AnyType;
  constructor(component: AnyType) {
    super();
    this.component = component;
  }
  override formatMeta(seen: Set<Type>) {
    return `component: ${this.component.format(seen)}`;
  }
  positiveTypes(): readonly AnyType[] {
    return [this.component];
  }
  negativeTypes(): readonly AnyType[] {
    return [this.component];
  }
}

abstract class AtomType extends Type {}

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

export type TSType =
  | TopType
  | NullType
  | StringType
  | BooleanType
  | IntType
  | BottomType;

export function isTSType(type: AnyType): type is TSType {
  return (
    type.clazz === "TopType" ||
    type.clazz === "NullType" ||
    type.clazz === "StringType" ||
    type.clazz === "BooleanType" ||
    type.clazz === "IntType" ||
    type.clazz === "BottomType"
  );
}

export type AnyConstructedType =
  | FunctionType
  | ReadonlyObjectType
  | ReadonlyArrayType
  | ArrayType;

export function isConstructedType(type: AnyType): type is AnyConstructedType {
  return (
    type.clazz === "FunctionType" ||
    type.clazz === "ReadonlyArrayType" ||
    type.clazz === "ReadonlyObjectType" ||
    type.clazz === "ArrayType"
  );
}

export enum TypePolarity {
  NONE = 0, // 0b00
  NEGATIVE = 1, // 0b01 - GENERAL - INPUT
  POSITIVE = 2, // 0b10 - SPECIFIC - OUTPUT
  BIPOLAR = 3, // 0b11
}

export function polarity(type: AnyType) {
  return isFreeType(type) ? type.polarity : null;
}

function isNegative(type: FreeType) {
  return (type.polarity & TypePolarity.NEGATIVE) !== 0;
}

function isPositive(type: FreeType) {
  return (type.polarity & TypePolarity.POSITIVE) !== 0;
}

class FreeType extends Type {
  readonly clazz = "FreeType";

  constructor(public polarity: TypePolarity) {
    super();
  }

  override setPolarity(polarity: TypePolarity, changed: Set<FreeType>) {
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
  | FunctionType
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

export type { FreeType, FunctionType };

const NULL_TYPE = new NullType();
const BOOL_TYPE = new BooleanType();
const INT_TYPE = new IntType();
const STRING_TYPE = new StringType();

const EMPTY_OBJ_TYPE = new ReadonlyObjectType([]);

const POSITION_TYPE = new ReadonlyObjectType([
  ["pos", INT_TYPE],
  ["line", INT_TYPE],
  ["column", INT_TYPE],
]);

const LOCATION_TYPE = new ReadonlyObjectType([
  ["start", POSITION_TYPE],
  ["end", POSITION_TYPE],
]);

export const runtimeTypes = {
  null: NULL_TYPE,
  number: INT_TYPE,
  string: STRING_TYPE,
  $Empty: EMPTY_OBJ_TYPE,
  $Position: POSITION_TYPE,
  $Location: LOCATION_TYPE,
};

export const runtimeFuncs = {
  getIndex: new FunctionType([], INT_TYPE),
  getText: new FunctionType([INT_TYPE], STRING_TYPE),
  getPos: new FunctionType([], POSITION_TYPE),
  getLoc: new FunctionType([POSITION_TYPE], LOCATION_TYPE),
};

export class TypesRegistry {
  readonly graph = new ConstraintsGraph();

  private readonly allTypes = new Set<AnyType>();
  private readonly locations = new Map<AnyType, AnyRule>();
  private readonly supers = new MapSet<AnyType, AnyType>();
  private readonly subs = new MapSet<AnyType, AnyType>();

  constructor() {
    this.saveRuntimeType(INT_TYPE);
    this.saveRuntimeType(STRING_TYPE);
    this.saveRuntimeType(POSITION_TYPE);
    this.saveRuntimeType(LOCATION_TYPE);
    this.saveRuntimeType(runtimeFuncs.getIndex);
    this.saveRuntimeType(runtimeFuncs.getText);
    this.saveRuntimeType(runtimeFuncs.getPos);
    this.saveRuntimeType(runtimeFuncs.getLoc);
  }

  private save<T extends AnyTypeExceptFree>(t: T, node: AnyRule): T {
    this.locations.set(t, node); // TODO for error messages, this will not work because we are reusing types...
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

  private saveRuntimeType<T extends AnyType>(t: T): T {
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
    let changedPositive = new Set<FreeType>();
    let changedNegative = new Set<FreeType>();

    for (const t of this.allTypes) {
      if (isFreeType(t)) {
        if (isPositive(t)) {
          changedPositive.add(t);
        }
        if (isNegative(t)) {
          changedNegative.add(t);
        }
      }
    }

    // TODO C_x (and C_y) should be at least "int"...

    while (changedPositive.size > 0 || changedNegative.size > 0) {
      const prevPositive = changedPositive;
      changedPositive = new Set();
      const prevNegative = changedNegative;
      changedNegative = new Set();

      for (const a of prevPositive) {
        for (const b of this.subs.get(a)) {
          if (isConstructedType(b)) {
            for (const t of b.positiveTypes()) {
              t.setPolarity(TypePolarity.POSITIVE, changedPositive);
            }
            for (const t of b.negativeTypes()) {
              t.setPolarity(TypePolarity.NEGATIVE, changedNegative);
            }
          }
          // TODO??? b.setPolarity(TypePolarity.POSITIVE, changedPositive);
        }
      }

      for (const a of prevNegative) {
        for (const b of this.supers.get(a)) {
          if (isConstructedType(b)) {
            for (const t of b.positiveTypes()) {
              t.setPolarity(TypePolarity.NEGATIVE, changedNegative);
            }
            for (const t of b.negativeTypes()) {
              t.setPolarity(TypePolarity.POSITIVE, changedPositive);
            }
          }
          // TODO??? b.setPolarity(TypePolarity.NEGATIVE, changedNegative);
        }
      }
    }
  }

  null(node: AnyRule) {
    return this.save(NULL_TYPE, node);
  }

  string(node: AnyRule) {
    return this.save(STRING_TYPE, node);
  }

  int(node: AnyRule) {
    return this.save(INT_TYPE, node);
  }

  boolean(node: AnyRule) {
    return this.save(BOOL_TYPE, node);
  }

  free(preference: TypePolarity = TypePolarity.NONE) {
    return this.saveFree(new FreeType(preference));
  }

  function(argNum: number, node: AnyRule) {
    const args = [];
    for (let i = 0; i < argNum; i++) {
      args.push(this.free());
    }
    return this.save(new FunctionType(args, this.free()), node);
  }

  readonlyObject(fields: readonly string[], node: AnyRule) {
    return this.save(
      fields.length === 0
        ? runtimeTypes.$Empty
        : new ReadonlyObjectType(fields.map(f => [f, this.free()])),
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

  *getErrors(): Generator<
    readonly [
      AnyTypeExceptFree,
      AnyTypeExceptFree,
      AnyRule | undefined,
      AnyRule | undefined
    ],
    void,
    unknown
  > {
    for (const [a, b] of this.supers) {
      if (a instanceof FreeType || b instanceof FreeType) continue;
      if (!isSubtype(a, b, this)) {
        yield [a, b, this.locations.get(a), this.locations.get(b)] as const;
      }
    }
  }
}

// TODO better errors (the location of errors)

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
  } else if (a instanceof FunctionType) {
    if (b instanceof FunctionType) {
      const size = Math.min(a.args.length, b.args.length);
      for (let i = 0; i < size; i++) {
        registry.subtype(b.args[i], a.args[i], node);
      }
      registry.subtype(a.ret, b.ret, node);
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

  if (a instanceof FreeType || b instanceof FreeType) {
    // At the entry we should not find free types
    // They might appear when checking the components of object, array, etc. types
    // Even in that case, we can just return true
    // Subtyping constraints between components are added anyway by implication
    // So they will be checked later anyway
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

  // T1 -> T2 is a subtype of T3 -> T4 if T3 <: T1 and T2 <: T4
  if (a instanceof FunctionType) {
    return (
      b instanceof FunctionType &&
      a.args.length === b.args.length &&
      a.args.every((argA, i) => isSubtype2(registry, set, b.args[i], argA)) &&
      isSubtype2(registry, set, a.ret, b.ret)
    );
  }

  never(a);
}

function isSubtype(a: AnyType, b: AnyType, registry: TypesRegistry): boolean {
  return isSubtype2(registry, new MapSet(), a, b);
}
