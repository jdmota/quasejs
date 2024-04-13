import { MapSet } from "../../utils/map-set";
import { GType } from "./types-builder";

export function isSub(a: GType, b: GType) {
  return isSubtype(new MapSet(), a, b);
}

export function isSubtype(
  set: MapSet<GType, GType>,
  _a: GType,
  _b: GType
): boolean {
  // Short-path: Even undefined variables can be considered equal if they are exactly the same
  if (_a === _b) return true;

  const a =
    _a.type === "recursive-var" ? (_a.defined() ? _a.definition() : null) : _a;
  const b =
    _b.type === "recursive-var" ? (_b.defined() ? _b.definition() : null) : _b;

  if (!a || !b) return false;

  // Short-path: Every type is a subtype of itself
  if (a === b) return true;

  if (set.test(a, b)) return true;
  set.add(a, b);

  // Get definition of recursive types
  if (a.type === "recursive") return isSubtype(set, a.content, b);
  if (b.type === "recursive") return isSubtype(set, a, b.content);

  // Every type is a subtype of TOP
  if (b.type === "top") return true;

  // BOTTOM is a subtype of any type
  if (a.type === "bot") return true;

  // Atom types are subtypes of themselves
  if (
    (a.type === "null" ||
      a.type === "string" ||
      a.type === "bool" ||
      a.type === "int") &&
    b.type === a.type
  )
    return true;

  // A ReadonlyObjectType is a subtype of another if all the keys in the second are in the first
  // and (for the common keys) the types in the first are subtypes of the ones in the second
  if (a.type === "readObject" && b.type === "readObject") {
    for (const [key, typeB] of b.fields) {
      const typeA = a.fields.get(key);
      if (typeA == null || !isSubtype(set, typeA, typeB)) {
        return false;
      }
    }
    return true;
  }

  // ReadonlyArray<T1> <: ReadonlyArray<T2> if T1 <: T2
  if (a.type === "readArray" && b.type === "readArray") {
    return isSubtype(set, a.component, b.component);
  }

  // Array<T1> type is a subtype of itself
  if (a.type === "array" && b.type === "array") {
    return (
      isSubtype(set, a.component, b.component) &&
      isSubtype(set, b.component, a.component)
    );
  }

  // Array<T1> type is a subtype of ReadonlyArray<T2> if T1 <: T2
  if (a.type === "array" && b.type === "readArray") {
    return isSubtype(set, a.component, b.component);
  }

  // T1 -> T2 is a subtype of T3 -> T4 if T3 <: T1 and T2 <: T4
  if (a.type === "func" && b.type === "func") {
    return (
      a.args.length === b.args.length &&
      a.args.every((argA, i) => isSubtype(set, b.args[i], argA)) &&
      isSubtype(set, a.ret, b.ret)
    );
  }

  if (a.type === "union" && b.type === "union") {
    return (
      a.types.every(inA => isSubtype(set, inA, b)) ||
      b.types.some(inB => isSubtype(set, a, inB))
    );
  }

  if (a.type === "union" && b.type === "inter") {
    return (
      a.types.every(inA => isSubtype(set, inA, b)) ||
      b.types.every(inB => isSubtype(set, a, inB))
    );
  }

  if (a.type === "inter" && b.type === "union") {
    return (
      a.types.some(inA => isSubtype(set, inA, b)) ||
      b.types.some(inB => isSubtype(set, a, inB))
    );
  }

  if (a.type === "inter" && b.type === "inter") {
    return (
      a.types.some(inA => isSubtype(set, inA, b)) ||
      b.types.every(inB => isSubtype(set, a, inB))
    );
  }

  if (a.type === "union") {
    return a.types.every(inA => isSubtype(set, inA, b));
  }

  if (a.type === "inter") {
    return a.types.some(inA => isSubtype(set, inA, b));
  }

  if (b.type === "union") {
    return b.types.some(inB => isSubtype(set, a, inB));
  }

  if (b.type === "inter") {
    return b.types.every(inB => isSubtype(set, a, inB));
  }

  return false;
}
