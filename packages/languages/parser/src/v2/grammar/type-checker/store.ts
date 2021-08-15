import { TypesRegistry, AnyType, FreeType, FreeTypePreference } from "./types";

export class Store {
  private readonly map: Map<string, FreeType> = new Map();
  private readonly registry: TypesRegistry;
  constructor(registry: TypesRegistry) {
    this.registry = registry;
  }

  set(name: string, type: AnyType) {
    this.registry.subtype(type, this.get(name), null);
  }

  get(name: string) {
    const curr = this.map.get(name);
    if (curr) return curr;
    const type = this.registry.free(FreeTypePreference.NONE);
    this.map.set(name, type);
    return type;
  }

  propagateTo(other: Store) {
    for (const [name, type] of this.map) {
      other.set(name, type);
    }
  }

  propagateToExcept(other: Store, except: string) {
    for (const [name, type] of this.map) {
      if (name !== except) {
        other.set(name, type);
      }
    }
  }

  toString(normalized: ReadonlyMap<AnyType, AnyType> = new Map()) {
    return `Store {${Array.from(this.map).map(
      ([k, v]) => `${k}: ${normalized.get(v) ?? v}`
    )}}`;
  }
}
