import { locSuffix, never } from "../utils";
import { Grammar } from "./grammar";
import {
  AnyRule,
  FieldRule,
  IdRule,
  RuleDeclaration,
  TokenRules,
} from "./grammar-builder";

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
    case "select":
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
    default:
      never(rule);
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

function visit(rule: AnyRule, fn: (rule: AnyRule) => void) {
  switch (rule.type) {
    case "seq":
      for (const r of rule.rules) {
        visit(r, fn);
      }
      break;
    case "choice":
      for (const r of rule.rules) {
        visit(r, fn);
      }
      break;
    case "repeat":
      visit(rule.rule, fn);
      break;
    case "repeat1":
      visit(rule.rule, fn);
      break;
    case "optional":
      visit(rule.rule, fn);
      break;
    case "field":
      visit(rule.rule, fn);
      break;
    case "select":
      fn(rule);
      visit(rule.parent, fn);
      break;
    case "eof":
    case "string":
    case "regexp":
    case "id":
    case "empty":
    case "action":
    case "predicate":
      fn(rule);
      break;
    default:
      never(rule);
  }
}

export function gatherTokens(rules: AnyRule[]) {
  const tokens: TokenRules[] = [];
  const visitor = (rule: AnyRule) => {
    if (
      rule.type === "string" ||
      rule.type === "regexp" ||
      rule.type === "eof"
    ) {
      tokens.push(rule);
    }
  };
  for (const rule of rules) {
    visit(rule, visitor);
  }
  return tokens;
}

export function gatherRuleIds(rules: ReadonlyMap<string, RuleDeclaration>) {
  const ids: IdRule[] = [];
  const visitor = (rule: AnyRule) => {
    if (rule.type === "id") {
      ids.push(rule);
    }
  };
  for (const rule of rules.values()) {
    visit(rule.rule, visitor);
  }
  return ids;
}

export function typecheck(grammar: Grammar) {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const [ruleName, store] of grammar.fields) {
    const fields = checkAmbiguousFields(store);
    if (fields.length > 0) {
      warnings.push(
        `In rule ${ruleName}, the fields ${fields
          .map(f => `"${f}"`)
          .join(", ")} are using at the same time = and +=`
      );
    }
  }

  switch (grammar.startRules.length) {
    case 0:
      errors.push("Missing start rule");
      break;
    case 1:
      // OK
      break;
    default:
      errors.push("Multiple start rules");
  }

  const ids = gatherRuleIds(grammar.rules);
  for (const id of ids) {
    if (!grammar.rules.has(id.id)) {
      errors.push(`Undefined rule ${id.id}${locSuffix(id.loc)}`);
    }
  }

  return {
    errors,
    warnings,
  };
}
