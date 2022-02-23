import { first, never, nonNull } from "../../utils";
import {
  AnyType,
  TypePolarity,
  isConstructedType,
  TypesRegistry,
} from "./types";

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

class FunctionType extends NormalizedType {
  readonly clazz = "FunctionType";

  constructor(
    readonly args: readonly AnyNormalizedType[],
    readonly ret: AnyNormalizedType
  ) {
    super();
  }

  format(): string {
    return `(${this.args
      .map(a => a.format())
      .join(", ")}) => ${this.ret.format()}`;
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

let genericUuid = 1;

class GenericType extends NormalizedType {
  readonly clazz = "GenericType";
  readonly id = genericUuid++;

  constructor(
    readonly lower: AnyNormalizedType,
    readonly upper: AnyNormalizedType
  ) {
    super();
  }

  format(): string {
    return `T${this.id}`;
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

class IntersectionType extends NormalizedType {
  readonly clazz = "IntersectionType";

  readonly types: ReadonlySet<AnyNormalizedType>;
  constructor(types: ReadonlySet<AnyNormalizedType>) {
    super();
    this.types = types;
  }

  format(): string {
    return `(${Array.from(this.types)
      .map(t => t.format())
      .join(" & ")})`;
  }
}

export type AnyNormalizedType =
  | RecursiveRef
  | FunctionType
  | ReadonlyObjectType
  | ReadonlyArrayType
  | ArrayType
  | TopType
  | StringType
  | IntType
  | BooleanType
  | NullType
  | BottomType
  | GenericType
  | UnionType
  | IntersectionType;

// TODO i think the point here is that
// we could choose the lower bound for every type
// of course we dont want that because that is not useful
// so we give polatiries to the types
// now the issue is, if I decide to choose the lower bound of some type
// I cannot cross a type that has choosen the upper bound

export class Normalizer {
  constructor(private readonly registry: TypesRegistry) {}

  private readonly cache = new Map<AnyType, AnyNormalizedType>();
  private readonly processing = new Map<AnyType, RecursiveRef>();

  normalize(type: AnyType) {
    const cached = this.cache.get(type);
    // If it was already normalized...
    if (cached) return cached;
    // Avoid infinite recursion...
    let rec = this.processing.get(type);
    if (rec) {
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
      case "FunctionType":
        return new FunctionType(
          type.args.map(a => this.normalize(a)),
          this.normalize(type.ret)
        );
      case "ReadonlyObjectType":
        return new ReadonlyObjectType(
          Array.from(type.fields).map(([k, v]) => [k, this.normalize(v)])
        );
      case "ReadonlyArrayType":
        return new ReadonlyArrayType(this.normalize(type.component));
      case "ArrayType":
        return new ArrayType(this.normalize(type.component));
      case "FreeType":
        switch (type.polarity) {
          case TypePolarity.NONE:
            throw new Error("Cannot normalize type with no polarity");
          case TypePolarity.POSITIVE: {
            const set = new Set<AnyNormalizedType>();
            for (const sub of this.registry.graph.lower(type)) {
              set.add(this.normalize(sub));
            }
            return union(set);
          }
          case TypePolarity.NEGATIVE: {
            const set = new Set<AnyNormalizedType>();
            for (const sub of this.registry.graph.upper(type)) {
              set.add(this.normalize(sub));
            }
            return intersection(set);
          }
          case TypePolarity.BIPOLAR: {
            const lowerSet = new Set<AnyNormalizedType>();
            for (const sub of this.registry.graph.lower(type)) {
              lowerSet.add(this.normalize(sub));
            }
            const upperSet = new Set<AnyNormalizedType>();
            for (const sub of this.registry.graph.upper(type)) {
              upperSet.add(this.normalize(sub));
            }
            return new GenericType(union(lowerSet), intersection(upperSet));
          }
          default:
            never(type.polarity);
        }
      default:
        never(type);
    }
  }
}

function* unionSeq(set: ReadonlySet<AnyNormalizedType>) {
  for (const t of set) {
    if (t.clazz === "UnionType") {
      for (const t2 of t.types) yield t2;
    } else {
      yield t;
    }
  }
}

// Sequence does not produce union types assuming "list" does not contain union types
function* intersectionSeq(set: ReadonlySet<AnyNormalizedType>) {
  for (const t of set) {
    if (t.clazz === "IntersectionType") {
      for (const t2 of t.types) yield t2;
    } else {
      yield t;
    }
  }
}

function union(originalSet: ReadonlySet<AnyNormalizedType>) {
  const set = originalSet ?? new Set<AnyNormalizedType>();
  /*outer: for (const t of unionSeq(originalSet)) {
    for (const it of set) {
      if (isSubtype(t, it)) break outer;
    }
    for (const it of set) {
      if (isSubtype(it, t)) set.delete(it);
    }
    set.add(t);
  }*/

  if (set.size === 0) {
    return new BottomType();
  }
  if (set.size === 1) {
    return first(set);
  }
  return new UnionType(set);
}

function intersection(originalSet: ReadonlySet<AnyNormalizedType>) {
  // TODO distribute unions over intersections
  // TODO simplify some intersections

  const set = originalSet ?? new Set<AnyNormalizedType>();
  /*outer: for (const t of intersectionSeq(originalSet)) {
    for (const it of set) {
      if (isSubtype(it, t)) break outer;
    }
    for (const it of set) {
      if (isSubtype(t, it)) set.delete(it);
    }
    set.add(t);
  }*/

  if (set.size === 0) {
    return new TopType();
  }
  if (set.size === 1) {
    return first(set);
  }
  return new IntersectionType(set);
}