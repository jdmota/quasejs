import { SchemaType } from "./schema-type.ts";
import {
  ArrayType,
  BigintType,
  BooleanType,
  FunctionType,
  IntersectionType,
  LiteralType,
  NeverType,
  NullType,
  NumberType,
  ObjectType,
  RecursiveType,
  StringType,
  SymbolType,
  TupleType,
  UndefinedType,
  UnionType,
  UnknownType,
} from "./builtin-types.ts";
import { computeIfAbsent } from "../util/maps-sets.ts";

class Cache {
  private readonly map = new Map<SchemaType, Map<SchemaType, boolean | null>>();

  set(a: SchemaType, b: SchemaType, val: boolean | null) {
    computeIfAbsent(
      this.map,
      a,
      () => new Map<SchemaType, boolean | null>()
    ).set(b, val);
  }

  get(a: SchemaType, b: SchemaType) {
    return computeIfAbsent(
      this.map,
      a,
      () => new Map<SchemaType, boolean | null>()
    ).get(b);
  }
}

export function isSub(a: SchemaType, b: SchemaType) {
  return isSubtype(new Cache(), a, b);
}

export function isSubtype(cache: Cache, a: SchemaType, b: SchemaType): boolean {
  // Short-path
  if (a === b) return true;
  let curr = cache.get(a, b);
  if (curr === null || curr === true) return true;
  cache.set(a, b, null);
  curr = isSubtypeImpl(cache, a, b);
  cache.set(a, b, curr);
  return curr;
}

function isSubtypeImpl(cache: Cache, a: SchemaType, b: SchemaType): boolean {
  // Handle recursive types
  if (a instanceof RecursiveType && b instanceof RecursiveType) {
    const cA = a.getContent();
    const cB = b.getContent();
    if (cA == null) {
      if (cB == null) {
        return false;
      }
      return isSubtype(cache, a, cB);
    } else {
      if (cB == null) {
        return isSubtype(cache, cA, b);
      }
      return isSubtype(cache, cA, cB);
    }
  }

  if (a instanceof RecursiveType) {
    const cA = a.getContent();
    return cA == null ? false : isSubtype(cache, cA, b);
  }

  if (b instanceof RecursiveType) {
    const cB = b.getContent();
    return cB == null ? false : isSubtype(cache, a, cB);
  }

  // Every type is a subtype of TOP
  if (b instanceof UnknownType) return true;

  // BOTTOM is a subtype of any type
  if (a instanceof NeverType) return true;

  // Atom types are subtypes of themselves
  if (a instanceof UndefinedType && b instanceof UndefinedType) return true;
  if (a instanceof NullType && b instanceof NullType) return true;
  if (a instanceof StringType && b instanceof StringType) return true;
  if (a instanceof NumberType && b instanceof NumberType) return true;
  if (a instanceof BigintType && b instanceof BigintType) return true;
  if (a instanceof BooleanType && b instanceof BooleanType) return true;
  if (a instanceof SymbolType && b instanceof SymbolType) return true;
  if (a instanceof LiteralType && b instanceof LiteralType)
    return a.value === b.value;

  // An object type is a subtype of another if all the keys in the second are in the first
  // and (for the common keys) the types in the first are subtypes of the ones in the second
  if (a instanceof ObjectType && b instanceof ObjectType) {
    if (typeof a.exact !== typeof b.exact) return false;
    if (typeof a.exact === "boolean" && a.exact !== b.exact) return false;

    if (a.exact === true && b.exact === true) {
      if (
        a.entries.length !== b.entries.length ||
        !a.entries.every(([keyA]) => b.entries.some(([keyB]) => keyA === keyB))
      ) {
        return false;
      }
    }

    if (typeof a.exact !== "boolean" && typeof b.exact !== "boolean") {
      if (
        (a.exact.partial && !b.exact.partial) ||
        (a.exact.readonly && !b.exact.readonly) ||
        !isSubtype(cache, a.exact.key, b.exact.key) ||
        !isSubtype(cache, b.exact.key, a.exact.key) ||
        !isSubtype(cache, a.exact.value, b.exact.value)
      ) {
        return false;
      }
    }

    for (const [key, infoB] of b.entries) {
      const infoA = a.entriesRecord[key];
      if (infoA == null) {
        if (infoB.partial) continue;
        return false;
      }
      if (
        (infoA.partial && !infoB.partial) ||
        (infoA.readonly && !infoB.readonly) ||
        !isSubtype(cache, infoA.type, infoB.type)
      ) {
        return false;
      }
    }
    return true;
  }

  if (a instanceof ArrayType && b instanceof ArrayType) {
    // ReadonlyArray<T1> <: ReadonlyArray<T2> if T1 <: T2
    // Array<T1> type is a subtype of ReadonlyArray<T2> if T1 <: T2
    if (b.readonly) {
      return isSubtype(cache, a.element, b.element);
    }
    // Array<T1> type is a subtype of itself (both mutable)
    if (!a.readonly) {
      return (
        isSubtype(cache, a.element, b.element) &&
        isSubtype(cache, b.element, a.element)
      );
    }
    return false;
  }

  if (a instanceof TupleType && b instanceof TupleType) {
    if (b.readonly) {
      // A tuple is a subtype of a readonly tuple if all the keys in the second are in the first
      // and (for the common keys) the types in the first are subtypes of the ones in the second
      const num = Math.max(a.elements.length, b.elements.length); // Deal with rest...
      const elemsA = Array.from(a.iterate(num));
      const elemsB = Array.from(b.iterate(num));
      return (
        elemsA.length >= elemsB.length &&
        elemsB.every((inB, i) => isSubtype(cache, elemsA[i].type, inB.type))
      );
    }
    if (!a.readonly) {
      const num = Math.max(a.elements.length, b.elements.length); // Deal with rest...
      const elemsA = Array.from(a.iterate(num));
      const elemsB = Array.from(b.iterate(num));
      return (
        elemsA.length === elemsB.length &&
        elemsB.every(
          (inB, i) =>
            isSubtype(cache, elemsA[i].type, inB.type) &&
            isSubtype(cache, inB.type, elemsA[i].type)
        )
      );
    }
    return false;
  }

  // T1 -> T2 is a subtype of T3 -> T4 if T3 <: T1 and T2 <: T4
  if (a instanceof FunctionType && b instanceof FunctionType) {
    // Contravariant on the arguments and covariant on the return
    return isSubtype(cache, b.args, a.args) && isSubtype(cache, a.ret, b.ret);
  }

  if (a instanceof UnionType && b instanceof UnionType) {
    return (
      a.items.every(inA => isSubtype(cache, inA, b)) ||
      b.items.some(inB => isSubtype(cache, a, inB))
    );
  }

  if (a instanceof UnionType && b instanceof IntersectionType) {
    return (
      a.items.every(inA => isSubtype(cache, inA, b)) ||
      b.items.every(inB => isSubtype(cache, a, inB))
    );
  }

  if (a instanceof IntersectionType && b instanceof UnionType) {
    return (
      a.items.some(inA => isSubtype(cache, inA, b)) ||
      b.items.some(inB => isSubtype(cache, a, inB))
    );
  }

  if (a instanceof IntersectionType && b instanceof IntersectionType) {
    return (
      a.items.some(inA => isSubtype(cache, inA, b)) ||
      b.items.every(inB => isSubtype(cache, a, inB))
    );
  }

  if (a instanceof UnionType) {
    return a.items.every(inA => isSubtype(cache, inA, b));
  }

  if (a instanceof IntersectionType) {
    return a.items.some(inA => isSubtype(cache, inA, b));
  }

  if (b instanceof UnionType) {
    return b.items.some(inB => isSubtype(cache, a, inB));
  }

  if (b instanceof IntersectionType) {
    return b.items.every(inB => isSubtype(cache, a, inB));
  }

  // TODO complete...
  return false;
}
