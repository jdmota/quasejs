import { all, any, never } from "../../utils";

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

class ReadonlyObjectType<T extends Type> extends Type {
  // https://github.com/Microsoft/TypeScript/wiki/FAQ#why-do-these-empty-classes-behave-strangely
  readonly clazz = "ReadonlyObjectType";

  readonly fields: ReadonlyMap<string, T>;
  constructor(fields: readonly (readonly [string, T])[]) {
    super();
    this.fields = new Map(fields);
  }
  formatMeta(seen: Set<Type>) {
    return Array.from(this.fields)
      .map(([k, v]) => `${k}: ${v.format(seen)}`)
      .join(", ");
  }
}

class ReadonlyArrayType<T extends Type> extends Type {
  // https://github.com/Microsoft/TypeScript/wiki/FAQ#why-do-these-empty-classes-behave-strangely
  readonly clazz = "ReadonlyArrayType";

  readonly component: T;
  constructor(component: T) {
    super();
    this.component = component;
  }
  formatMeta(seen: Set<Type>) {
    return `component: ${this.component.format(seen)}`;
  }
}

class ArrayType<T extends Type> extends Type {
  // https://github.com/Microsoft/TypeScript/wiki/FAQ#why-do-these-empty-classes-behave-strangely
  readonly clazz = "ArrayType";

  readonly component: T;
  constructor(component: T) {
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

export function isFreeType(t: AnyType): t is FreeType {
  return t instanceof FreeType;
}

export class TypesRegistry {
  private readonly allTypes = new Set<AnyType>();
  private readonly supers = new Map<AnyType, Set<AnyType>>();
  private readonly subs = new Map<AnyType, Set<AnyType>>();
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
    return t;
  }

  constructor() {
    for (const t of Object.values(this.t)) {
      this.allTypes.add(t);
    }
  }

  subtype(a: AnyType, b: AnyType) {
    const supers = this.supers.get(a) ?? new Set();
    supers.add(b);
    const subs = this.subs.get(b) ?? new Set();
    subs.add(a);

    this.supers.set(a, supers);
    this.subs.set(b, subs);
  }

  getSupers(t: AnyType): ReadonlySet<AnyType> {
    return this.supers.get(t) ?? new Set();
  }

  getSubs(t: AnyType): ReadonlySet<AnyType> {
    return this.subs.get(t) ?? new Set();
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
  | ReadonlyObjectType<AnyType>
  | ReadonlyArrayType<AnyType>
  | ArrayType<AnyType>
  | TopType
  | NullType
  | StringType
  | BooleanType
  | IntType
  | BottomType
  | FreeType;

export type AnyTypeExceptFree =
  | ReadonlyObjectType<AnyTypeExceptFree>
  | ReadonlyArrayType<AnyTypeExceptFree>
  | ArrayType<AnyTypeExceptFree>
  | TopType
  | NullType
  | StringType
  | BooleanType
  | IntType
  | BottomType;

export type AnyTypeMinusFree = Exclude<AnyType, FreeType>;

export type { FreeType };

export function isSubtype(
  a: AnyType,
  b: AnyType,
  free: ReadonlyMap<AnyType, ReadonlySet<AnyTypeMinusFree>>
): boolean {
  // Short-path: Every type is a subtype of itself
  if (a === b) return true;

  // Every type is a subtype of TOP
  if (b instanceof TopType) return true;

  // BOTTOM is a subtype of any type
  if (a instanceof BottomType) return true;

  // For all...
  if (a instanceof FreeType) {
    return all(free.get(a)!!, typeA => isSubtype(typeA, b, free));
  }

  // For any...
  if (b instanceof FreeType) {
    return any(free.get(b)!!, typeB => isSubtype(a, typeB, free));
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
        if (typeA == null || !isSubtype(typeA, typeB, free)) {
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
      isSubtype(a.component, b.component, free)
    );
  }

  // Array<T1> type is a subtype of itself and ReadonlyArray<T2> if T1 <: T2
  if (a instanceof ArrayType) {
    return (
      (b instanceof ArrayType &&
        isSubtype(a.component, b.component, free) &&
        isSubtype(b.component, a.component, free)) ||
      (b instanceof ReadonlyArrayType &&
        isSubtype(a.component, b.component, free))
    );
  }

  never(a);
}

export function areSubtypesOfAll(
  subs: ReadonlySet<AnyType>,
  supers: ReadonlySet<AnyType>
) {}
