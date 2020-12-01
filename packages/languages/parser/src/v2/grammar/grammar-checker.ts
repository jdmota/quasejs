import { never } from "../utils";
import { AnyRule, FieldRule, TokenRules } from "./grammar-builder";

export type ReadonlyFieldStoreValue = {
  readonly name: string;
  readonly fields: readonly FieldRule[];
  readonly optional: boolean;
  readonly multiple: boolean;
};

type FieldStoreValue = {
  name: string;
  fields: FieldRule[];
  optional: boolean;
  multiple: boolean;
};

export interface ReadonlyFieldsStore {
  isOptional(name: string): boolean;
  [Symbol.iterator](): IterableIterator<ReadonlyFieldStoreValue>;
}

class FieldsStore implements ReadonlyFieldsStore {
  private readonly fields;

  constructor() {
    this.fields = new Map<string, FieldStoreValue>();
  }

  isOptional(name: string): boolean {
    const f = this.fields.get(name);
    return f ? f.optional : true;
  }

  set(name: string, fields: readonly FieldRule[], optional: boolean) {
    const current = this.fields.get(name);
    if (current == null) {
      this.fields.set(name, {
        name,
        fields: [...fields],
        optional,
        multiple: false,
      });
    } else {
      for (const f of fields) {
        current.fields.push(f);
      }
      current.optional = optional;
    }
  }

  markAllOptional() {
    for (const f of this.fields.values()) {
      f.optional = true;
    }
  }

  importFrom(store: ReadonlyFieldsStore) {
    for (const { name, fields, optional } of store) {
      this.set(name, fields, optional);
    }
  }

  [Symbol.iterator](): IterableIterator<ReadonlyFieldStoreValue> {
    return this.fields.values();
  }

  finalize(): ReadonlyFieldsStore {
    for (const f of this.fields.values()) {
      f.multiple = f.fields.some(f => f.multiple);
      f.optional = f.optional && !f.multiple;
    }
    return this;
  }
}

function getFieldsHelper(rule: AnyRule): FieldsStore {
  const store = new FieldsStore();
  switch (rule.type) {
    case "seq": {
      for (const r of rule.rules) {
        for (const { name, fields, optional } of getFieldsHelper(r)) {
          store.set(name, fields, optional && store.isOptional(name));
        }
      }
      return store;
    }
    case "choice": {
      const counts: { [key: string]: number } = {};
      for (const r of rule.rules) {
        for (const { name, fields, optional } of getFieldsHelper(r)) {
          store.set(name, fields, optional);
          counts[name] = (counts[name] || 0) + 1;
        }
      }
      for (const [name, count] of Object.entries(counts)) {
        if (count < rule.rules.length) {
          // If fields appear in some alternatives and not others,
          // the field is optional
          store.set(name, [], true);
        }
      }
      return store;
    }
    case "optional":
    case "repeat": {
      store.importFrom(getFieldsHelper(rule.rule));
      store.markAllOptional();
      return store;
    }
    case "repeat1": {
      store.importFrom(getFieldsHelper(rule.rule));
      return store;
    }
    case "id":
    case "empty":
    case "eof":
    case "string":
    case "regexp":
    case "action":
    case "predicate":
      return store;
    case "field": {
      store.set(rule.name, [rule], false);
      return store;
    }
  }
}

export function getFields(rule: AnyRule): ReadonlyFieldsStore {
  return getFieldsHelper(rule).finalize();
}

export function checkAmbiguousFields(store: ReadonlyFieldsStore): string[] {
  const ambiguous: string[] = [];
  for (const { name, fields } of store) {
    const multiple = fields.some(f => f.multiple);
    const single = fields.some(f => !f.multiple);
    if (single && multiple) {
      ambiguous.push(name);
    }
  }
  return ambiguous;
}

function gatherTokensHelper(rule: AnyRule, tokens: TokenRules[]) {
  switch (rule.type) {
    case "seq":
      for (const r of rule.rules) {
        gatherTokensHelper(r, tokens);
      }
      break;
    case "choice":
      for (const r of rule.rules) {
        gatherTokensHelper(r, tokens);
      }
      break;
    case "repeat":
      gatherTokensHelper(rule.rule, tokens);
      break;
    case "repeat1":
      gatherTokensHelper(rule.rule, tokens);
      break;
    case "optional":
      gatherTokensHelper(rule.rule, tokens);
      break;
    case "field":
      gatherTokensHelper(rule.rule, tokens);
      break;
    case "eof":
    case "string":
    case "regexp":
      tokens.push(rule);
      break;
    case "id":
    case "empty":
    case "action":
    case "predicate":
      break;
    default:
      never(rule);
  }
}

export function gatherTokens(rules: AnyRule[]) {
  const tokens: TokenRules[] = [];
  for (const rule of rules) {
    gatherTokensHelper(rule, tokens);
  }
  return tokens;
}
