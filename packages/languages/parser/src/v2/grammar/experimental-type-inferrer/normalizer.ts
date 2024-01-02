import { first, never, nonNull } from "../../utils";
import {
  AnyType,
  FreeType,
  TypePolarity,
  TypesRegistry,
  formatPolarity,
  isAtomType,
  isFreeType,
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

class GenericType extends NormalizedType {
  readonly clazz = "GenericType";

  constructor(
    public readonly lower: AnyNormalizedType,
    public readonly upper: AnyNormalizedType,
    public readonly polarity: TypePolarity,
    public readonly name: string
  ) {
    super();
  }

  format(): string {
    return `${this.name}(${formatPolarity(
      this.polarity
    )})[${this.lower.format()},${this.upper.format()}]`;
  }
}

class AliasType extends NormalizedType {
  readonly clazz = "AliasType";

  constructor(public readonly name: string) {
    super();
  }

  isAux() {
    return this.name.startsWith("$_T");
  }

  format(): string {
    return `${this.name}`;
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
  | AliasType
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

const EXPERIMENTAL = false;

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
            // Get the lower bound and do not "go beyond" types with negative polarity
            const set = new Set<AnyNormalizedType>();
            for (const sub of this.registry.graph.lower(type)) {
              set.add(this.normalize(sub));
            }
            return union(set);
          }
          case TypePolarity.NEGATIVE: {
            // Get the upper bound and do not "go beyond" types with positive polarity
            const set = new Set<AnyNormalizedType>();
            for (const sub of this.registry.graph.upper(type)) {
              set.add(this.normalize(sub));
            }
            return intersection(set);
          }
          case TypePolarity.BIPOLAR: {
            // Get both bounds
            const lowerSet = new Set<AnyNormalizedType>();
            for (const sub of this.registry.graph.lower(type)) {
              lowerSet.add(this.normalize(sub));
            }
            const upperSet = new Set<AnyNormalizedType>();
            for (const sub of this.registry.graph.upper(type)) {
              upperSet.add(this.normalize(sub));
            }
            return new GenericType(
              union(lowerSet),
              intersection(upperSet),
              type.polarity,
              type.ensureName()
            );
          }
          default:
            never(type.polarity);
        }
      default:
        never(type);
    }
  }

  private cache2 = new Map<AnyType, AnyNormalizedType>();
  private cache3 = new Map<string, AnyNormalizedType>();

  getFromCache(name: string) {
    return nonNull(this.cache3.get(name));
  }

  normalize2(type: AnyType): AnyNormalizedType {
    if (isAtomType(type)) {
      return this._normalize2(type);
    }
    const name = type.ensureName();
    const alias = new AliasType(name);
    const inCache = this.cache2.get(type);
    if (inCache) {
      return alias.isAux() ? inCache : alias;
    }
    this.cache2.set(type, alias);
    const normalized = this._normalize2(type);
    this.cache2.set(type, normalized);
    this.cache3.set(name, normalized);
    return normalized;
  }

  private _normalize2(type: AnyType): AnyNormalizedType {
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
          type.args.map(a => this.normalize2(a)),
          this.normalize2(type.ret)
        );
      case "ReadonlyObjectType":
        return new ReadonlyObjectType(
          Array.from(type.fields).map(([k, v]) => [k, this.normalize2(v)])
        );
      case "ReadonlyArrayType":
        return new ReadonlyArrayType(this.normalize2(type.component));
      case "ArrayType":
        return new ArrayType(this.normalize2(type.component));
      case "FreeType":
        if (!EXPERIMENTAL) {
          // Get the lower bound
          const set = new Set<AnyNormalizedType>();
          for (const sub of this.registry.graph.lowerAny(type)) {
            set.add(this.normalize2(sub));
          }
          return union(set);
        }

        let negativeToPositive = false;

        const lowerSet = new Set<AnyNormalizedType>();
        for (const sub of this.registry.graph.lower(type)) {
          negativeToPositive ||=
            type.polarity === TypePolarity.POSITIVE &&
            isFreeType(sub) &&
            sub.polarity === TypePolarity.NEGATIVE;

          lowerSet.add(this.normalize2(sub));
        }

        const upperSet = new Set<AnyNormalizedType>();
        for (const sup of this.registry.graph.upper(type)) {
          negativeToPositive ||=
            type.polarity === TypePolarity.NEGATIVE &&
            isFreeType(sup) &&
            sup.polarity === TypePolarity.POSITIVE;

          upperSet.add(this.normalize2(sup));
        }

        const lowerBound = union(lowerSet);
        const upperBound = intersection(upperSet);

        switch (type.polarity) {
          case TypePolarity.NONE:
            throw new Error("Cannot normalize type with no polarity");
          case TypePolarity.POSITIVE:
            if (!negativeToPositive) {
              return lowerBound;
            }
            break;
          case TypePolarity.NEGATIVE: {
            if (!negativeToPositive) {
              return upperBound;
            }
            break;
          }
          case TypePolarity.BIPOLAR:
            break;
          default:
            never(type.polarity);
        }
        return new GenericType(
          lowerBound,
          upperBound,
          type.polarity,
          type.ensureName()
        );
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
